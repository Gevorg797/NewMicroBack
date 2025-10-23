import { Injectable, Logger } from '@nestjs/common';
import { SuperomaticUtilsService } from './superomatic.utils.service';
import { SuperomaticApiService } from './superomatic.api.service';
import { ProviderSettingsService } from './provider-settings.service';
import { SessionManagerService } from '../repository/session-manager.service';
import { EntityManager } from '@mikro-orm/postgresql';
import { wrap } from '@mikro-orm/core';
import { Game, GameProvider, GameSubProvider } from '@lib/database';
import { IExtendedGameProvider, ProviderPayload, GameLoadResult, CloseSessionPayload } from '../interfaces/game-provider.interface';

@Injectable()
export class SuperomaticService implements IExtendedGameProvider {
    private readonly logger = new Logger(SuperomaticService.name);
    constructor(
        private readonly providerSettings: ProviderSettingsService,
        private readonly api: SuperomaticApiService,
        private readonly utils: SuperomaticUtilsService,
        private readonly sessionManager: SessionManagerService,
        private readonly em: EntityManager,
    ) {
        this.logger.log('SuperomaticService initialized');
    }

    async loadGames(payload: ProviderPayload): Promise<GameLoadResult> {
        this.logger.debug(`Loading games for site: ${payload.siteId}`);

        const { params, siteId } = payload;
        const { baseURL, providerId } = await this.providerSettings.getProviderSettings(siteId);

        // Call Superomatic API with proper parameters
        const apiResponse = await this.api.getGames(baseURL, params);

        // Extract games from Superomatic API response
        const gamesList: Array<any> = (apiResponse?.games || apiResponse?.response || []);
        this.logger.debug(`Retrieved ${gamesList.length} games from Superomatic API`);

        let loadGamesCount = 0;
        let deleteGamesCount = 0;

        const providerRef = await this.em.findOneOrFail(GameProvider, { id: providerId });

        // Hard reset: delete games and sub-providers of this provider
        if (params?.isHardReset) {
            this.logger.debug('Performing hard reset - deleting existing games');
            const subProviders = await this.em.find(GameSubProvider, { provider: providerRef });
            for (const sp of subProviders) {
                const toDelete = await this.em.find(Game, { subProvider: sp });
                deleteGamesCount += toDelete.length;
                await this.em.removeAndFlush(toDelete);
            }
            // Remove sub-providers after removing games
            await this.em.removeAndFlush(subProviders);
            this.logger.debug(`Deleted ${deleteGamesCount} existing games`);
        }

        for (const game of gamesList) {
            const groupName: string = game.group || 'default';
            let subProvider = await this.em.findOne(GameSubProvider, { name: groupName, provider: providerRef });
            if (!subProvider) {
                subProvider = new GameSubProvider();
                wrap(subProvider).assign({ name: groupName, provider: providerRef });
                await this.em.persistAndFlush(subProvider);
            }

            // Upsert by superomatic id as uuid
            const existing = await this.em.findOne(Game, { uuid: String(game.id) });
            if (existing) {
                wrap(existing).assign({
                    name: game.title,
                    type: game.type,
                    image: game.icon,
                    subProvider,
                    metadata: { provider: game.provider, isEnabled: game.is_enabled },
                });
                await this.em.flush();
            } else {
                const newGame = new Game();
                wrap(newGame).assign({
                    name: game.title,
                    uuid: String(game.id),
                    type: game.type,
                    technology: 'html5',
                    isHasLobby: false,
                    isMobile: true,
                    isHasFreeSpins: true,
                    isHasTables: false,
                    isFreeSpinValidUntilFullDay: false,
                    isDesktop: true,
                    image: game.icon,
                    subProvider,
                    metadata: { provider: game.provider, isEnabled: game.is_enabled },
                });
                await this.em.persistAndFlush(newGame);
            }

            loadGamesCount++;
        }

        const result: GameLoadResult = {
            loadGamesCount,
            deleteGamesCount,
            totalGames: gamesList.length,
            games: gamesList.slice(0, 10) // Return first 10 games as sample
        };

        this.logger.debug(`Successfully loaded ${loadGamesCount} games from Superomatic`);
        return result;
    }

    async getCurrencies(payload: ProviderPayload): Promise<any> {
        this.logger.debug(`Getting currencies for site: ${payload.siteId}`);

        const { baseURL } = await this.providerSettings.getProviderSettings(payload.siteId);
        const response = await this.api.getCurrenciesList(baseURL);

        this.logger.debug('Successfully retrieved currencies from Superomatic');
        return response;
    }

    async initGameDemoSession(payload: ProviderPayload): Promise<any> {
        this.logger.debug(`Initializing demo session for game: ${payload.params.gameId}`);

        const { params, siteId } = payload;
        const { baseURL, key } = await this.providerSettings.getProviderSettings(siteId);

        // Transform unified payload to Superomatic-specific format
        const superomaticParams = {
            'game.id': params.gameId,
            'balance': Math.round(params.balance * 100), // Convert to cents
            'denomination': Math.round(params.denomination * 100), // Convert to cents
            'currency': params.currency,
        };

        const sign = this.utils.generateSigniture(
            superomaticParams,
            key,
            '/init.demo.session',
        );
        const response = await this.api.getGameDemoSession(baseURL, {
            ...superomaticParams,
            sign,
        });

        this.logger.debug('Successfully initialized demo session with Superomatic');
        return response;
    }

    async initGameSession(payload: ProviderPayload): Promise<any> {
        this.logger.debug(`Initializing game session for game: ${payload.params.gameId}`);

        const { params, siteId, userId, balanceType } = payload;
        const { baseURL, key, partnerAlias } = await this.providerSettings.getProviderSettings(siteId);


        // Create database session first - generates our session ID
        const sessionResult = await this.sessionManager.createRealSession({
            userId,
            gameId: params.gameId,
            denomination: params.denomination?.toString() || '1.00',
            providerName: 'Superomatic',
            balanceType, // Pass balance type from payload
            metadata: { ...params }
        });


        // Send our session ID to provider
        const superomaticParams = {
            'partner.alias': partnerAlias,
            'partner.session': sessionResult.sessionId, // Send our session ID
            'game.id': sessionResult.gameUuid,
            'currency': sessionResult.currency, // Use currency from user balance
            ...(params.freeroundsId && { 'freerounds.id': params.freeroundsId }),
        };

        const sign = this.utils.generateSigniture(superomaticParams, key, '/init.session');

        try {
            const providerResponse = await this.api.getGameSession(baseURL, {
                ...superomaticParams,
                sign,
            });

            // Update session with provider response (launch URL, etc.)
            await this.sessionManager.updateSessionWithProviderResponse(
                sessionResult.sessionId,
                providerResponse
            );

            this.logger.debug('Successfully initialized game session with Superomatic');

            return {
                launchUrl: `${providerResponse.response.clientDist}?t=${providerResponse.response.token}`, // Construct full launch URL
                sessionId: sessionResult.sessionId,
                gameUuid: sessionResult.gameUuid,
                currency: sessionResult.currency,
            };
        } catch (error) {
            this.logger.error(`Failed to get game session from Superomatic: ${error.message}`);

            // Close the session in database if provider call fails
            await this.em.nativeUpdate(
                'GameSession',
                { id: parseInt(sessionResult.sessionId) },
                {
                    isAlive: false,
                    isLive: false,
                    endedAt: new Date()
                }
            );

            this.logger.debug(`Closed session ${sessionResult.sessionId} due to provider error`);

            // Re-throw the error so caller knows about the failure
            throw error;
        }
    }

    async gamesFreeRoundsInfo(payload: ProviderPayload): Promise<any> {
        this.logger.debug(`Getting free rounds info for freerounds.id: ${payload.params.freeroundsId}`);

        const { params, siteId } = payload;
        const { baseURL, key, partnerAlias } = await this.providerSettings.getProviderSettings(siteId);

        // This endpoint only checks freeround status - no session creation needed
        // Only requires: partner.alias, freerounds.id, and sign
        const superomaticParams = {
            'partner.alias': partnerAlias || params.partnerAlias,
            'freerounds.id': params.freeroundsId,
        };

        const sign = this.utils.generateSigniture(superomaticParams, key, '/games.freeroundsInfo');
        const providerResponse = await this.api.gamesFreeRoundsInfo(baseURL, {
            ...superomaticParams,
            sign,
        });

        this.logger.debug('Successfully retrieved free rounds info from Superomatic');

        // Response contains: max_step, steps, total_win
        return providerResponse;
    }

    async closeSession(payload: CloseSessionPayload): Promise<any> {
        this.logger.debug(`Closing session for user: ${payload.userId}`);

        const { userId } = payload;

        // Find the active session for this user (with user.site populated to get siteId)
        const activeSessions = await this.sessionManager.getActiveSessions(userId);

        if (!activeSessions || activeSessions.length === 0) {
            this.logger.warn(`No active session found for user: ${userId}`);
            throw new Error(`No active session found for user: ${userId}`);
        }

        // Use the first active session (assuming one session per user)
        const session = activeSessions[0];

        if (!session.id) {
            throw new Error(`Invalid session data for user: ${userId}`);
        }

        // Get siteId from the session's user
        const siteId = session.user?.site?.id;
        if (!siteId) {
            throw new Error(`Cannot determine siteId for user: ${userId}`);
        }

        const sessionId = session.id.toString(); // Our database session ID

        this.logger.debug(`Found active session ${sessionId} for user ${userId} on site ${siteId}`);

        // Get provider settings using siteId from user
        const { baseURL, key, partnerAlias } = await this.providerSettings.getProviderSettings(siteId);

        // Superomatic close.session only needs partner.alias and partner.session
        // Send the same session ID that was sent to Superomatic during init.session
        const superomaticParams = {
            'partner.alias': partnerAlias,
            'partner.session': sessionId, // Same ID we sent during init
        };

        const sign = this.utils.generateSigniture(superomaticParams, key, '/close.session');
        const response = await this.api.closeSession(baseURL, {
            ...superomaticParams,
            sign,
        });

        // Close our database session
        // The endAmount and diff will be calculated automatically based on transactions
        await this.sessionManager.closeSession(sessionId);

        this.logger.debug(`Successfully closed session ${sessionId} for user ${userId}`);

        // Response is just: { method: "close.session", status: 200, response: true }
        return response;
    }



}
