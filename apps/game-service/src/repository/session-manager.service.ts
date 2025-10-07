import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { wrap } from '@mikro-orm/core';
import {
  GameSession,
  GameTransaction,
  GameTransactionType,
  Game,
  User,
  Balances,
  BalanceType,
} from '@lib/database';

export interface CreateSessionParams {
  userId: number;
  gameId: string;
  denomination: string;
  providerName: string;
  isDemo?: boolean;
  metadata?: any;
}

export interface SessionResult {
  sessionId: string;
  sessionUuid: string;
  launchUrl?: string;
  gameToken?: string;
  partnerSession?: string;
  metadata?: any;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Creates a new game session in the database for real (non-demo) games
   */
  async createRealSession(params: CreateSessionParams): Promise<SessionResult> {
    this.logger.debug(
      `Creating real session for user ${params.userId}, game ${params.gameId}`,
    );

    // Find the game, user, and balance entities
    const game = await this.em.findOne(Game, { uuid: params.gameId });
    if (!game) {
      throw new Error(`Game not found: ${params.gameId}`);
    }

    const user = await this.em.findOne(User, { id: params.userId });
    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // Check if user already has an alive session
    const existingAliveSession = await this.em.findOne(GameSession, {
      user: { id: params.userId },
      isAlive: true,
    });

    if (existingAliveSession) {
      throw new Error(
        `User ${params.userId} already has an active session. Please close the current session first.`,
      );
    }

    // Get main balance for the game session
    const balance = await this.em.findOne(Balances, {
      user: { id: params.userId },
      type: BalanceType.MAIN,
    });
    if (!balance) {
      throw new Error(`Main balance not found for user: ${params.userId}`);
    }

    // Generate unique session identifiers
    const sessionUuid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const partnerSessionId = `partner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create the game session entity
    const gameSession = new GameSession();
    wrap(gameSession).assign({
      user,
      game,
      uuid: partnerSessionId, // This is the partner session ID sent to providers
      balanceId: balance.id,
      startAmount: balance.balance, // Use actual balance from user's balance record
      denomination: params.denomination,
      isLive: true, // Real session
      metadata: {
        providerName: params.providerName,
        currency: balance.currency.name,
        sessionId: sessionUuid, // Internal session ID
        partnerSessionId, // Partner session ID
        ...params.metadata,
      },
      startedAt: new Date(),
    });

    await this.em.persistAndFlush(gameSession);

    this.logger.debug(
      `Created game session with ID: ${gameSession.id}, UUID: ${sessionUuid}`,
    );

    return {
      sessionId: gameSession.id.toString(),
      sessionUuid,
      launchUrl: gameSession.launchURL,
      gameToken: sessionUuid, // Use internal session UUID as game token
      partnerSession: partnerSessionId, // Use partner session ID for providers
      metadata: {
        providerName: params.providerName,
        currency: balance.currency.name,
        sessionId: sessionUuid, // Internal session ID
        partnerSessionId, // Partner session ID
        ...params.metadata,
      },
    };
  }

  /**
   * Updates session with provider response data (launch URL, etc.)
   */
  async updateSessionWithProviderResponse(
    sessionUuid: string,
    providerResponse: any,
  ): Promise<void> {
    this.logger.debug(`Updating session ${sessionUuid} with provider response`);

    const session = await this.em.findOne(GameSession, { uuid: sessionUuid });
    if (!session) {
      throw new Error(`Session not found: ${sessionUuid}`);
    }

    // Update session with provider response data
    const updates: Partial<GameSession> = {
      launchURL: providerResponse.launch_url || providerResponse.url,
      metadata: {
        ...(session.metadata || {}),
        providerResponse,
        updatedAt: new Date().toISOString(),
      },
    };

    wrap(session).assign(updates);
    await this.em.flush();

    this.logger.debug(`Updated session ${sessionUuid} with provider data`);
  }

  /**
   * Creates a game transaction record
   */
  async createTransaction(
    sessionUuid: string,
    type: GameTransactionType,
    amount: number,
    metadata?: any,
  ): Promise<void> {
    this.logger.debug(
      `Creating ${type} transaction for session ${sessionUuid}: ${amount}`,
    );

    const session = await this.em.findOne(GameSession, { uuid: sessionUuid });
    if (!session) {
      throw new Error(`Session not found: ${sessionUuid}`);
    }

    const transaction = new GameTransaction();
    wrap(transaction).assign({
      session,
      type,
      amount,
    });

    await this.em.persistAndFlush(transaction);

    this.logger.debug(
      `Created transaction ${transaction.id} for session ${sessionUuid}`,
    );
  }

  /**
   * Closes a game session
   */
  async closeSession(sessionUuid: string, endAmount?: number): Promise<void> {
    this.logger.debug(`Closing session ${sessionUuid}`);

    const session = await this.em.findOne(GameSession, { uuid: sessionUuid });
    if (!session) {
      throw new Error(`Session not found: ${sessionUuid}`);
    }

    wrap(session).assign({
      isAlive: false,
      endedAt: new Date(),
      endAmount,
    });

    await this.em.flush();

    this.logger.debug(`Closed session ${sessionUuid}`);
  }

  /**
   * Gets session by UUID
   */
  async getSession(sessionUuid: string): Promise<GameSession | null> {
    return this.em.findOne(GameSession, { uuid: sessionUuid });
  }

  /**
   * Gets active sessions for a user
   */
  async getActiveSessions(userId: number): Promise<GameSession[]> {
    return this.em.find(GameSession, {
      user: { id: userId },
      isAlive: true,
    });
  }
}
