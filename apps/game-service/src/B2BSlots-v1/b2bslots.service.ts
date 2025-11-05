import { Injectable, Logger } from '@nestjs/common';
import { B2BSlotsProviderSettingsService } from './provider-settings.service';
import { B2BSlotsApiService } from './b2bslots.api.service';
import { B2BSlotsUtilsService } from './b2bslots.utils.service';
import { SessionManagerService } from '../repository/session-manager.service';
import { IGameProvider, ProviderPayload, GameLoadResult, CloseSessionPayload } from '../interfaces/game-provider.interface';
import { EntityManager } from '@mikro-orm/postgresql';
import { wrap } from '@mikro-orm/core';
import { Game, GameProvider, GameSubProvider, User, GameFreeSpin } from '@lib/database';

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

    const { baseURL, key, token } = await this.settings.getProviderSettings(payload.siteId);

    // B2BSlots doesn't have separate demo/real session endpoints
    // Generate game launch URL directly (demo mode uses special user_id or auth token)
    const gameCode = payload.params.gameId;
    const operatorId = token; // Operator ID from settings
    const demoUserId = 'demo_' + Date.now();
    const demoAuthToken = 'demo_token_' + Date.now();
    const currency = payload.params.currency || 'USD';
    const language = payload.params.language || 'en';

    // Generate launch URL using utility method
    const launchUrl = this.utils.generateGameUrlByCode(
      baseURL,
      parseInt(gameCode),
      parseInt(operatorId || '0'),
      demoUserId,
      demoAuthToken,
      currency,
      language
    );

    this.logger.debug('Successfully initialized demo session with B2BSlots');
    return {
      launchUrl,
      sessionId: demoAuthToken,
      gameUuid: gameCode,
      currency,
      isDemo: true
    };
  }

  async initGameSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Initializing game session for game: ${payload.params.gameId}`);

    const { baseURL, key, token } = await this.settings.getProviderSettings(payload.siteId);

    // Create database session first - generates our session ID and UUID
    const sessionResult = await this.sessionManager.createRealSession({
      userId: payload.userId,
      gameId: payload.params.gameId,
      denomination: payload.params.denomination?.toString() || '1.00',
      providerName: 'B2BSlots',
      balanceType: payload.balanceType,
    });

    // B2BSlots uses direct game URL construction instead of API call
    // The session UUID becomes the auth_token
    const gameCode = sessionResult.gameUuid;
    const operatorId = token; // Operator ID from settings
    const userId = payload.userId.toString();
    const authToken = sessionResult.sessionId; // Our session ID as auth token
    const currency = sessionResult.currency;
    const language = payload.params.language || 'en';
    const homeUrl = payload.params.homeUrl;

    // Generate launch URL using utility method
    const launchUrl = this.utils.generateGameUrlByCode(
      baseURL,
      parseInt(gameCode),
      parseInt(operatorId || '0'),
      userId,
      authToken,
      currency,
      language,
      homeUrl
    );

    // Update session with launch URL
    await this.sessionManager.updateSessionWithProviderResponse(
      sessionResult.sessionId,
      {
        response: {
          clientDist: launchUrl.split('?')[0],
          token: authToken
        }
      }
    );

    this.logger.debug('Successfully initialized game session with B2BSlots');

    return {
      launchUrl,
      sessionId: sessionResult.sessionId,
      gameUuid: sessionResult.gameUuid,
      currency: sessionResult.currency,
    };
  }

  async gamesFreeRoundsInfo(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Getting free rounds info for game: ${payload.params.gameId}`);

    const { token } = await this.settings.getProviderSettings(payload.siteId);

    // Get active free spins from database
    const game = await this.em.findOne(Game, { uuid: payload.params.gameId });
    if (!game) {
      throw new Error(`Game not found: ${payload.params.gameId}`);
    }

    const user = await this.em.findOne(User, { id: payload.userId });
    if (!user) {
      throw new Error(`User not found: ${payload.userId}`);
    }

    const freeSpins = await this.em.find(GameFreeSpin, {
      user,
      game,
      isActive: true,
      deletedAt: null
    });

    this.logger.debug(`Found ${freeSpins.length} active free spins for user ${payload.userId}`);

    return {
      freeSpins: freeSpins.map(fs => ({
        id: fs.id,
        count: fs.betCount,
        denomination: fs.denomination,
        activeUntil: fs.activeUntil,
        isActivated: fs.isActivated
      }))
    };
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

    // Get provider settings using siteId from session
    const { baseURL, key } = await this.settings.getProviderSettings(siteId);

    // Transform Superomatic-style payload to B2BSlots format
    const b2bPayload = {
      user_id: payload.userId.toString(),
      user_ip: payload.params?.userIp || '127.0.0.1',
      user_game_token: payload.params?.gameToken || payload.params?.userGameToken,
      currency: payload.params?.currency || 'USD'
    };

    const sign = this.utils.sign(b2bPayload, key);
    const response = await this.api.closeSession(baseURL, { ...b2bPayload, sign });

    // Close our database session
    // The endAmount and diff will be calculated automatically based on transactions
    await this.sessionManager.closeSession(sessionId);

    this.logger.debug(`Successfully closed session ${sessionId} for user ${userId}`);

    // Response is just: { method: "close.session", status: 200, response: true }
    return response;
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
