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
    providerName?: string;
    isDemo?: boolean;
    metadata?: any;
    balanceType?: BalanceType; // Specify which balance type to use (main or bonus)
}

export interface SessionResult {
    sessionId: string;
    gameUuid: string;
    currency: string;
    balanceType?: BalanceType; // Optional: which balance type was used
}

@Injectable()
export class SessionManagerService {
    private readonly logger = new Logger(SessionManagerService.name);

    constructor(private readonly em: EntityManager) { }

    /**
     * Creates a new game session in the database for real (non-demo) games
     */
    async createRealSession(params: CreateSessionParams): Promise<SessionResult> {
        this.logger.debug(
            `Creating real session for user ${params.userId}, game ${params.gameId}`,
        );

        // Determine which balance type to use (default to MAIN if not specified)
        const balanceType = params.balanceType || BalanceType.MAIN;

        // Fetch and validate all required entities in parallel
        const [game, user, balance, existingAliveSession] = await Promise.all([
            this.em.findOne(Game, { uuid: params.gameId }),
            this.em.findOne(User, { id: params.userId }),
            this.em.findOne(
                Balances,
                { user: { id: params.userId }, type: balanceType }, // Query specific balance type
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
            balance, // Store reference to the balance entity (which has type: main/bonus)
            startAmount: balance.balance,
            denomination: params.denomination,
            metadata: { ...params.metadata },
            isLive: true,
            startedAt: new Date(),
        });

        await this.em.persistAndFlush(gameSession);

        if (!gameSession.id) {
            throw new Error('Game session ID not found');
        }

        const sessionId = gameSession.id.toString();

        // Update UUID with the auto-increment ID
        // await this.em.nativeUpdate(
        //     GameSession,
        //     { id: gameSession.id },
        //     { uuid: sessionId },
        // );

        this.logger.debug(`Created game session with ID: ${sessionId}`);

        return {
            sessionId,
            gameUuid: params.gameId,
            currency: balance.currency.name,
            balanceType: balance.type, // Return the balance type from the balance entity
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

        // Extract launch URL based on provider response format
        // Superomatic uses response.clientDist
        // B2BSlots and others use launch_url or url
        const launchURL =
            providerResponse?.response?.clientDist ||
            providerResponse?.launch_url ||
            providerResponse?.url ||
            null;

        // Extract token/uuid based on provider response format
        // Superomatic uses response.token
        const providerToken = providerResponse?.response?.token || null;

        // Update session with provider response data
        const updates: Partial<GameSession> = {
            launchURL,
            isAlive: true, // Mark session as alive when provider response is received
            ...(providerToken && { uuid: providerToken }), // Update UUID only if Superomatic provides a token
            metadata: {
                ...(session.metadata || {}),
                providerResponse,
                ...(providerToken && { token: providerToken }), // Save token if available
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
     * Closes a game session and updates user balance if endAmount is provided
     */
    async closeSession(sessionId: string, endAmount?: number): Promise<void> {
        this.logger.debug(`Closing session ${sessionId} with endAmount: ${endAmount || 'N/A'}`);

        const session = await this.em.findOne(
            GameSession,
            { id: parseInt(sessionId) },
            { populate: ['balance'] }
        );
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Update session closure data
        wrap(session).assign({
            isAlive: false,
            endedAt: new Date(),
            endAmount,
        });

        // Update user's balance if endAmount is provided
        if (endAmount !== undefined && session.balance) {
            this.logger.debug(
                `Updating balance from ${session.balance.balance} to ${endAmount} for session ${sessionId}`
            );

            wrap(session.balance).assign({
                balance: endAmount,
            });
        }

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
        return this.em.find(
            GameSession,
            {
                user: { id: userId },
                isAlive: true,
            },
            { populate: ['balance', 'user.site'] }
        );
    }
}
