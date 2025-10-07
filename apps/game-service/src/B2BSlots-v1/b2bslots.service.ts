import { Injectable, Logger } from '@nestjs/common';
import { B2BSlotsProviderSettingsService } from './provider-settings.service';
import { B2BSlotsApiService } from './b2bslots.api.service';
import { B2BSlotsUtilsService } from './b2bslots.utils.service';
import { SessionManagerService } from '../repository/session-manager.service';
import { IGameProvider, ProviderPayload, GameLoadResult } from '../interfaces/game-provider.interface';
import { EntityManager } from '@mikro-orm/postgresql';
import { wrap } from '@mikro-orm/core';
import { Game, GameProvider, GameSubProvider } from '@lib/database';

@Injectable()
export class B2BSlotsService implements IGameProvider {
  private readonly logger = new Logger(B2BSlotsService.name);
  constructor(
    private readonly settings: B2BSlotsProviderSettingsService,
    private readonly api: B2BSlotsApiService,
    private readonly utils: B2BSlotsUtilsService,
    private readonly sessionManager: SessionManagerService,
    private readonly em: EntityManager,
  ) {
    this.logger.log('B2BSlotsService initialized');
  }

  async loadGames(payload: ProviderPayload): Promise<GameLoadResult> {
    this.logger.debug(`Loading games for site: ${payload.siteId}`);

    const { baseURL, token, providerId } = await this.settings.getProviderSettings(payload.siteId);

    // Use the B2BSlots games list API with operator ID
    const games = await this.api.getGames(baseURL, token);

    if (!Array.isArray(games) || games.length === 0) {
      this.logger.warn('No games received from B2BSlots API');
      return {
        loadGamesCount: 0,
        deleteGamesCount: 0,
        totalGames: 0,
        games: [],
      };
    }

    // Get or create the main provider
    let provider = await this.em.findOne(GameProvider, { id: providerId }) || undefined;
    if (!provider) {
      provider = new GameProvider();
      wrap(provider).assign({
        name: 'B2BSlots',
      });
      await this.em.persistAndFlush(provider);
    }

    // Track unique subproviders
    const subProviderMap = new Map<string, GameSubProvider>();
    let loadGamesCount = 0;

    // Process each game
    for (const gameData of games) {
      try {
        // Get or create subprovider
        const subProviderName = gameData.subProvider || 'Unknown';
        let subProvider = subProviderMap.get(subProviderName);

        if (!subProvider) {
          subProvider = await this.em.findOne(GameSubProvider, {
            name: subProviderName,
            provider: provider
          }) || undefined;

          if (!subProvider) {
            subProvider = new GameSubProvider();
            wrap(subProvider).assign({
              name: subProviderName,
              provider,
            });
            await this.em.persistAndFlush(subProvider);
          }
          subProviderMap.set(subProviderName, subProvider);
        }

        // Check if game already exists
        let existingGame = await this.em.findOne(Game, {
          uuid: gameData.uuid,
          subProvider
        });

        if (existingGame) {
          // Update existing game
          wrap(existingGame).assign({
            name: gameData.name,
            type: gameData.type,
            technology: gameData.technology,
            isHasLobby: gameData.isHasLobby,
            isMobile: gameData.isMobile,
            isHasFreeSpins: gameData.isHasFreeSpins,
            isHasTables: gameData.isHasTables,
            isFreeSpinValidUntilFullDay: gameData.isFreeSpinValidUntilFullDay,
            isDesktop: gameData.isDesktop,
            image: gameData.image,
            metadata: gameData.metadata,
          });
          await this.em.flush();
        } else {
          // Create new game
          const newGame = new Game();
          wrap(newGame).assign({
            name: gameData.name,
            uuid: gameData.uuid,
            type: gameData.type,
            technology: gameData.technology,
            isHasLobby: gameData.isHasLobby,
            isMobile: gameData.isMobile,
            isHasFreeSpins: gameData.isHasFreeSpins,
            isHasTables: gameData.isHasTables,
            isFreeSpinValidUntilFullDay: gameData.isFreeSpinValidUntilFullDay,
            isDesktop: gameData.isDesktop,
            image: gameData.image,
            subProvider,
            metadata: gameData.metadata,
          });
          await this.em.persistAndFlush(newGame);
        }

        loadGamesCount++;
      } catch (error) {
        this.logger.error(`Failed to process game ${gameData.name}:`, error.message);
      }
    }

    const result: GameLoadResult = {
      loadGamesCount,
      deleteGamesCount: 0,
      totalGames: games.length,
      games: games.slice(0, 10),
    };

    this.logger.debug(`Successfully loaded ${result.loadGamesCount} games from B2BSlots`);
    return result;
  }

  async getCurrencies(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Getting currencies for site: ${payload.siteId}`);

    const { baseURL } = await this.settings.getProviderSettings(payload.siteId);
    const result = await this.api.getCurrencies(baseURL);

    this.logger.debug('Successfully retrieved currencies from B2BSlots');
    return result;
  }

  async initGameDemoSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Initializing demo session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      user_id: payload.userId.toString(),
      user_ip: payload.params.userIp || '127.0.0.1',
      user_auth_token: payload.params.partnerSession || payload.params.authToken,
      currency: payload.params.currency || 'USD',
      game_code: parseInt(payload.params.gameId) || 0,
      game_name: payload.params.gameName || 'DemoGame'
    };

    const sign = this.utils.sign(b2bPayload, key);
    const result = await this.api.initDemo(baseURL, { ...b2bPayload, sign });

    this.logger.debug('Successfully initialized demo session with B2BSlots');
    return result;
  }

  async initGameSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Initializing game session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Create database session first - generates our session ID
    const sessionResult = await this.sessionManager.createRealSession({
      userId: payload.userId,
      gameId: payload.params.gameId,
      denomination: payload.params.denomination?.toString() || '1.00',
      providerName: 'B2BSlots',
    });

    // Send our session ID to provider
    const b2bPayload = {
      user_id: payload.userId.toString(),
      user_ip: payload.params.userIp || '127.0.0.1',
      user_auth_token: sessionResult.sessionId, // Send our session ID
      currency: sessionResult.currency, // Use currency from user balance
      game_code: parseInt(sessionResult.gameUuid) || 0,
      game_name: payload.params.gameName || 'Game'
    };

    const sign = this.utils.sign(b2bPayload, key);
    const providerResult = await this.api.initSession(baseURL, { ...b2bPayload, sign });

    // Update session with provider response (launch URL, etc.)
    await this.sessionManager.updateSessionWithProviderResponse(
      sessionResult.sessionId,
      providerResult
    );

    this.logger.debug('Successfully initialized game session with B2BSlots');

    return {
      ...providerResult,
      sessionId: sessionResult.sessionId,
      gameUuid: sessionResult.gameUuid,
      currency: sessionResult.currency,
    };
  }

  async gamesFreeRoundsInfo(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Getting free rounds info for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Create database session first - generates our session ID
    const sessionResult = await this.sessionManager.createRealSession({
      userId: payload.userId,
      gameId: payload.params.gameId,
      denomination: payload.params.denomination?.toString() || '1.00',
      providerName: 'B2BSlots',
    });

    // Send our session ID to provider
    const b2bPayload = {
      user_id: payload.userId.toString(),
      user_ip: payload.params.userIp || '127.0.0.1',
      user_game_token: sessionResult.sessionId, // Send our session ID
      currency: sessionResult.currency, // Use currency from user balance
      game_code: parseInt(sessionResult.gameUuid) || 0,
      game_name: payload.params.gameName || 'Game'
    };

    const sign = this.utils.sign(b2bPayload, key);
    const providerResult = await this.api.freeRoundsInfo(baseURL, { ...b2bPayload, sign });

    // Update session with provider response
    await this.sessionManager.updateSessionWithProviderResponse(
      sessionResult.sessionId,
      providerResult
    );

    this.logger.debug('Successfully retrieved free rounds info from B2BSlots');

    return {
      ...providerResult,
      sessionId: sessionResult.sessionId,
      gameUuid: sessionResult.gameUuid,
      currency: sessionResult.currency,
    };
  }

  async closeSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Closing session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      user_id: payload.userId.toString(),
      user_ip: payload.params.userIp || '127.0.0.1',
      user_game_token: payload.params.gameToken || payload.params.userGameToken,
      currency: payload.params.currency || 'USD'
    };

    const sign = this.utils.sign(b2bPayload, key);
    const result = await this.api.closeSession(baseURL, { ...b2bPayload, sign });

    // Close our database session if we have the session ID
    if (payload.params.sessionId) {
      await this.sessionManager.closeSession(payload.params.sessionId);
    }

    this.logger.debug('Successfully closed session with B2BSlots');
    return result;
  }

  /**
   * Process bet (debit) operation - missing from B2BSlots API
   */
  async processBet(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Processing bet for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      api: 'do-debit-user-ingame',
      data: {
        user_id: payload.userId.toString(),
        user_ip: payload.params.userIp || '127.0.0.1',
        user_game_token: payload.params.gameToken || payload.params.userGameToken,
        currency: payload.params.currency || 'USD',
        turn_id: payload.params.turnId || 1,
        transaction_id: payload.params.transactionId || this.generateTransactionId(),
        game_code: parseInt(payload.params.gameId) || 0,
        game_name: payload.params.gameName || 'Game',
        debit_amount: payload.params.betAmount?.toString() || '0.00',
        round_id: payload.params.roundId || 1
      }
    };

    const result = await this.api.processBet(baseURL, b2bPayload);
    this.logger.debug('Successfully processed bet with B2BSlots');
    return result;
  }

  /**
   * Process win (credit) operation - missing from B2BSlots API
   */
  async processWin(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Processing win for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      api: 'do-credit-user-ingame',
      data: {
        user_id: payload.userId.toString(),
        user_ip: payload.params.userIp || '127.0.0.1',
        user_game_token: payload.params.gameToken || payload.params.userGameToken,
        currency: payload.params.currency || 'USD',
        turn_id: payload.params.turnId || 1,
        transaction_id: payload.params.transactionId || this.generateTransactionId(),
        game_code: parseInt(payload.params.gameId) || 0,
        game_name: payload.params.gameName || 'Game',
        credit_amount: payload.params.winAmount?.toString() || '0.00',
        round_id: payload.params.roundId || 1,
        credit_type: payload.params.creditType || 'regular'
      }
    };

    const result = await this.api.processWin(baseURL, b2bPayload);
    this.logger.debug('Successfully processed win with B2BSlots');
    return result;
  }

  /**
   * Activate features (free rounds) - missing from B2BSlots API
   */
  async activateFeatures(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Activating features for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      api: 'do-activate-features-user-ingame',
      data: {
        user_id: payload.userId.toString(),
        user_ip: payload.params.userIp || '127.0.0.1',
        user_game_token: payload.params.gameToken || payload.params.userGameToken,
        currency: payload.params.currency || 'USD',
        game_code: parseInt(payload.params.gameId) || 0,
        game_name: payload.params.gameName || 'Game',
        free_rounds: {
          id: payload.params.featureId || 1
        }
      }
    };

    const result = await this.api.activateFeatures(baseURL, b2bPayload);
    this.logger.debug('Successfully activated features with B2BSlots');
    return result;
  }

  /**
   * Update features progress - missing from B2BSlots API
   */
  async updateFeatures(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Updating features for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      api: 'do-update-features-user-ingame',
      data: {
        user_id: payload.userId.toString(),
        user_ip: payload.params.userIp || '127.0.0.1',
        user_game_token: payload.params.gameToken || payload.params.userGameToken,
        currency: payload.params.currency || 'USD',
        game_code: parseInt(payload.params.gameId) || 0,
        game_name: payload.params.gameName || 'Game',
        free_rounds: {
          id: payload.params.featureId || 1,
          win: payload.params.totalWin?.toString() || '0',
          round_win: payload.params.roundWin?.toString() || '0',
          count: payload.params.remainingRounds || 0,
          played: payload.params.playedRounds || 0
        }
      }
    };

    const result = await this.api.updateFeatures(baseURL, b2bPayload);
    this.logger.debug('Successfully updated features with B2BSlots');
    return result;
  }

  /**
   * End features - missing from B2BSlots API
   */
  async endFeatures(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Ending features for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      api: 'do-end-features-user-ingame',
      data: {
        user_id: payload.userId.toString(),
        user_ip: payload.params.userIp || '127.0.0.1',
        user_game_token: payload.params.gameToken || payload.params.userGameToken,
        currency: payload.params.currency || 'USD',
        game_code: parseInt(payload.params.gameId) || 0,
        game_name: payload.params.gameName || 'Game',
        free_rounds: {
          id: payload.params.featureId || 1,
          win: payload.params.totalWin?.toString() || '0'
        }
      }
    };

    const result = await this.api.endFeatures(baseURL, b2bPayload);
    this.logger.debug('Successfully ended features with B2BSlots');
    return result;
  }

  /**
   * Generate unique transaction ID for B2BSlots
   */
  private generateTransactionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
