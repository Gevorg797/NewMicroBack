import { Injectable, Logger } from '@nestjs/common';
import { ProviderStrategyFactory } from './strategies/provider-strategy.factory';
import { SessionPayload, ProviderPayload, LoadGamesPayload, CloseSessionPayload } from './interfaces/game-provider.interface';
import { SessionManagerService } from './repository/session-manager.service';

/**
 * Main Game Service that routes requests to appropriate providers based on gameId
 * 
 * This service acts as a unified gateway that:
 * 1. Receives requests with gameId
 * 2. Determines the appropriate provider using the strategy factory
 * 3. Routes the request to the correct provider service implementation
 * 
 * Features:
 * - Strategy pattern for provider routing (eliminates switch statements)
 * - Comprehensive error handling with custom exceptions
 * - Structured logging for debugging and monitoring
 * - Type-safe interfaces for all operations
 * 
 * Usage:
 * - Use unified message patterns: 'game.initGameSession', 'game.initGameDemoSession', etc.
 * - The payload must include gameId which determines the provider routing
 * - The gameId is transformed to provider-specific format before forwarding
 */
@Injectable()
export class GameService {
    private readonly logger = new Logger(GameService.name);

    constructor(
        private readonly providerStrategyFactory: ProviderStrategyFactory,
        private readonly sessionManager: SessionManagerService,
    ) {
        this.logger.log('GameService initialized with strategy pattern');
    }

    /**
     * Helper method to prepare provider payload from session payload
     */
    private async prepareProviderPayload(sessionPayload: SessionPayload): Promise<ProviderPayload> {
        this.logger.debug(`Preparing provider payload for game: ${sessionPayload.gameId}`);

        if (!sessionPayload.gameId) {
            throw new Error('gameId is required for this operation');
        }

        const providerInfo = await this.providerStrategyFactory.getGameProvider(sessionPayload.gameId);

        // Transform gameId to provider-specific format
        const providerPayload: ProviderPayload = {
            userId: sessionPayload.userId,
            siteId: sessionPayload.siteId || 0, // Required for provider settings lookup
            balanceType: sessionPayload.balanceType, // Pass balance type to provider
            params: {
                ...sessionPayload.params,
                gameId: providerInfo.gameId,
                gameUuid: providerInfo.gameIdStr,
            },
        };

        this.logger.debug(`Provider payload prepared for: ${providerInfo.providerName}`);
        return providerPayload;
    }

    /**
     * Generic method to execute provider operations
     */
    private async executeProviderOperation<T>(
        sessionPayload: SessionPayload,
        operation: string,
        providerMethod: (provider: any, payload: ProviderPayload) => Promise<T>
    ): Promise<T> {
        this.logger.debug(`Executing ${operation} for game: ${sessionPayload.gameId}`);

        if (!sessionPayload.gameId) {
            throw new Error('gameId is required for this operation');
        }

        const providerPayload = await this.prepareProviderPayload(sessionPayload);
        const providerInfo = await this.providerStrategyFactory.getGameProvider(sessionPayload.gameId);
        const provider = this.providerStrategyFactory.getProviderStrategy(providerInfo.providerName);

        const result = await providerMethod(provider, providerPayload);
        this.logger.debug(`${operation} completed successfully for provider: ${providerInfo.providerName}`);
        return result;
    }

    /**
     * Closes an existing session using all information from the session object
     */
    private async closeExistingSession(existingSession: any): Promise<void> {
        this.logger.debug(`Closing existing session ${existingSession.id}`);

        try {
            // Extract information from the existing session
            const userId = existingSession.user?.id;
            const siteId = existingSession.user?.site?.id;
            const providerName = existingSession.game?.subProvider?.provider?.name?.toLowerCase();
            const sessionUuid = existingSession.uuid;
            const currency = existingSession.balance?.currency?.name || 'USD';

            // Validate required fields
            if (!providerName) {
                throw new Error(`Cannot determine provider name from session ${existingSession.id}`);
            }

            if (!userId) {
                throw new Error(`Cannot determine user ID from session ${existingSession.id}`);
            }

            // Create CloseSessionPayload
            const closeSessionPayload: CloseSessionPayload = {
                userId: userId,
                siteId: siteId,
                params: {
                    gameToken: sessionUuid,
                    currency: currency
                }
            };

            // Close the session using the existing interface
            await this.closeSessionWithPayload(closeSessionPayload, providerName);

            this.logger.debug(`Successfully closed session ${existingSession.id} for user ${userId} with provider ${providerName}`);
        } catch (error) {
            this.logger.error(`Failed to close session ${existingSession.id}: ${error.message}`);
            // Still close in database even if provider call fails
            await this.sessionManager.closeSession(existingSession.id.toString());
            throw error;
        }
    }

    /**
     * Closes a session using CloseSessionPayload interface
     */
    private async closeSessionWithPayload(
        closeSessionPayload: CloseSessionPayload,
        providerName: string
    ): Promise<void> {
        this.logger.debug(`Closing session for user ${closeSessionPayload.userId} with provider ${providerName}`);

        // Get the provider strategy
        const provider = this.providerStrategyFactory.getProviderStrategy(providerName);

        // Close session with the provider using the CloseSessionPayload directly
        await provider.closeSession(closeSessionPayload);
    }

    /**
     * Routes session creation requests to the appropriate provider
     * Checks for existing alive sessions before creating new ones
     */
    async initGameSession(payload: SessionPayload): Promise<any> {
        this.logger.debug(`Checking for existing sessions for user: ${payload.userId}, game: ${payload.gameId}`);

        // Check for existing alive sessions for this user
        const existingSessions = await this.sessionManager.getActiveSessions(payload.userId);

        if (existingSessions && existingSessions.length > 0) {
            this.logger.log(`Found ${existingSessions.length} active session(s) for user ${payload.userId}`);

            // Check if user has an alive session for the same game
            const sameGameSession = existingSessions.find(session =>
                session.game && session.game.id === payload.gameId
            );

            if (sameGameSession) {
                this.logger.log(`User ${payload.userId} already has an active session for game ${payload.gameId}, returning existing launch URL`);
                return {
                    launchUrl: sameGameSession.launchURL,
                    sessionId: sameGameSession.id?.toString(),
                    gameUuid: sameGameSession.game.uuid,
                    currency: sameGameSession.balance?.currency?.name || 'USD',
                    isExistingSession: true
                };
            }

            // User has alive sessions but for different games - close the existing session
            this.logger.log(`User ${payload.userId} has active session for different game, closing it first`);

            // Close the existing session with all information from the session
            const existingSession = existingSessions[0];
            if (existingSession.game.id !== payload.gameId) {
                await this.closeExistingSession(existingSession);
                this.logger.log(`Closed existing session ${existingSession.id} for user ${payload.userId}`);
            }
        }

        // Proceed with normal session creation
        return this.executeProviderOperation(
            payload,
            'initGameSession',
            (provider, providerPayload) => provider.initGameSession(providerPayload)
        );
    }

    /**
     * Routes demo session creation requests to the appropriate provider
     */
    async initGameDemoSession(payload: SessionPayload): Promise<any> {
        return this.executeProviderOperation(
            payload,
            'initGameDemoSession',
            (provider, providerPayload) => provider.initGameDemoSession(providerPayload)
        );
    }

    /**
     * Routes free rounds info requests to the appropriate provider
     */
    async gamesFreeRoundsInfo(payload: SessionPayload): Promise<any> {
        return this.executeProviderOperation(
            payload,
            'gamesFreeRoundsInfo',
            (provider, providerPayload) => provider.gamesFreeRoundsInfo(providerPayload)
        );
    }

    /**
     * Routes close session requests to the appropriate provider
     * Determines provider from user's active session (no gameId required)
     */
    async closeSession(payload: SessionPayload): Promise<any> {
        this.logger.debug(`Closing session for user: ${payload.userId}`);

        // Get the provider from the user's active session
        const providerName = await this.providerStrategyFactory.getProviderFromUserId(payload.userId);
        const provider = this.providerStrategyFactory.getProviderStrategy(providerName);

        const providerPayload: ProviderPayload = {
            userId: payload.userId,
            siteId: payload.siteId || 0, // siteId will be determined from user's session
            balanceType: payload.balanceType,
            params: payload.params || {},
        };

        const result = await provider.closeSession(providerPayload);
        this.logger.debug(`closeSession completed successfully for provider: ${providerName}`);
        return result;
    }

    /**
     * Routes load games requests to the appropriate provider using provider name
     */
    async loadGames(payload: LoadGamesPayload): Promise<any> {
        this.logger.debug(`Loading games for provider: ${payload.providerName}, site: ${payload.siteId}`);

        const provider = this.providerStrategyFactory.getProviderStrategy(payload.providerName);

        const providerPayload: ProviderPayload = {
            userId: 0, // System operation, no specific user
            siteId: payload.siteId,
            params: payload.params || {},
        };

        const result = await provider.loadGames(providerPayload);
        this.logger.debug(`loadGames completed successfully for provider: ${payload.providerName}`);
        return result;
    }

    /**
     * Routes get currencies requests to the appropriate provider
     */
    async getCurrencies(payload: SessionPayload): Promise<any> {
        return this.executeProviderOperation(
            payload,
            'getCurrencies',
            (provider, providerPayload) => provider.getCurrencies(providerPayload)
        );
    }
}
