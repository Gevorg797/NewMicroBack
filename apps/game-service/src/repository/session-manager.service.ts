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
  gameUuid: string;
  currency: string;
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

    // Fetch and validate all required entities in parallel
    const [game, user, balance, existingAliveSession] = await Promise.all([
      this.em.findOne(Game, { uuid: params.gameId }),
      this.em.findOne(User, { id: params.userId }),
      this.em.findOne(
        Balances,
        { user: { id: params.userId } },
        { populate: ['currency'] },
      ),
      this.em.findOne(GameSession, {
        user: { id: params.userId },
        isAlive: true,
      }),
    ]);

    if (!game) {
      throw new Error(`Game not found: ${params.gameId}`);
    }

    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }

    if (!balance) {
      throw new Error(`Balance not found for user: ${params.userId}`);
    }

    if (existingAliveSession) {
      throw new Error(
        `User ${params.userId} already has an active session. Please close the current session first.`,
      );
    }

    // Create session using ORM to get auto-increment ID first
    const gameSession = new GameSession();
    wrap(gameSession).assign({
      user,
      game,
      uuid: 'temp', // Temporary, will update after flush
      balanceId: balance.id,
      startAmount: balance.balance,
      denomination: params.denomination,
      isLive: true,
      startedAt: new Date(),
    });

    await this.em.persistAndFlush(gameSession);

    if (!gameSession.id) {
      throw new Error('Game session ID not found');
    }

    const sessionId = gameSession.id.toString();

    // Update UUID with the auto-increment ID
    await this.em.nativeUpdate(
      GameSession,
      { id: gameSession.id },
      { uuid: sessionId },
    );

    this.logger.debug(`Created game session with ID: ${sessionId}`);

    return {
      sessionId,
      gameUuid: params.gameId,
      currency: balance.currency.name,
    };
  }

  /**
   * Updates session with provider response data (launch URL, etc.)
   */
  async updateSessionWithProviderResponse(
    sessionId: string,
    providerResponse: any,
  ): Promise<void> {
    this.logger.debug(`Updating session ${sessionId} with provider response`);

    const session = await this.em.findOne(GameSession, {
      id: parseInt(sessionId),
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
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

    this.logger.debug(`Updated session with ${sessionId} with provider data`);
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
  async closeSession(sessionId: string, endAmount?: number): Promise<void> {
    this.logger.debug(`Closing session ${sessionId}`);

    const session = await this.em.findOne(GameSession, {
      id: parseInt(sessionId),
    });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    wrap(session).assign({
      isAlive: false,
      endedAt: new Date(),
      endAmount,
    });

    await this.em.flush();

    this.logger.debug(`Closed session ${sessionId}`);
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
