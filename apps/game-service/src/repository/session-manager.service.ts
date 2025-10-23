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
    GameOutcome,
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
        const [game, user, balance, existingLiveSession] = await Promise.all([
            this.em.findOne(Game, { uuid: params.gameId }),
            this.em.findOne(User, { id: params.userId }),
            this.em.findOne(
                Balances,
                { user: { id: params.userId }, type: balanceType }, // Query specific balance type
                { populate: ['currency'] },
            ),
            this.em.findOne(GameSession, {
                user: { id: params.userId },
                isLive: true,
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

        if (existingLiveSession) {
            throw new Error(
                `User ${params.userId} already has an active session.`,
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

        // Extract token/uuid based on provider response format
        // Superomatic uses response.token
        const providerLaunchUrl = providerResponse?.response?.clientDist || null;
        const providerToken = providerResponse?.response?.token || null;


        // Update session with provider response data
        const updates: Partial<GameSession> = {
            launchURL: `${providerLaunchUrl}?t=${providerToken}`,
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
     * Closes a game session and calculates end amount and diff based on transactions
     */
    async closeSession(sessionId: string): Promise<void> {
        this.logger.debug(`Closing session ${sessionId}`);

        const session = await this.em.findOne(
            GameSession,
            { id: parseInt(sessionId) },
            { populate: ['balance', 'transactions'] }
        );
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Calculate profit/loss from transactions
        let totalDeposits = 0;
        let totalWithdraws = 0;
        const transactions = session.transactions.getItems();

        for (const transaction of transactions) {
            // Skip canceled transactions
            if (transaction.isCanceled) {
                continue;
            }

            const amount = Number(transaction.amount);

            if (transaction.type === GameTransactionType.DEPOSIT) {
                totalDeposits += amount;
            } else if (transaction.type === GameTransactionType.WITHDRAW) {
                totalWithdraws += amount;
            }
        }

        // Calculate end amount: startAmount - deposits + withdraws
        const endAmount = session.startAmount + totalDeposits - totalWithdraws;

        // Calculate diff (total amount lost/won)
        const diff = session.startAmount - endAmount;

        // Determine outcome based on profit/loss
        let outcome: GameOutcome;
        if (endAmount > session.startAmount) {
            outcome = GameOutcome.WIN;
        } else if (endAmount < session.startAmount) {
            outcome = GameOutcome.LOST;
        } else {
            outcome = GameOutcome.DRAW;
        }

        this.logger.debug(
            `Session ${sessionId} calculation: startAmount=${session.startAmount}, ` +
            `deposits=${totalDeposits}, withdraws=${totalWithdraws}, ` +
            `endAmount=${endAmount}, diff=${diff}, outcome=${outcome}`
        );

        // Update session closure data
        wrap(session).assign({
            isAlive: false,
            isLive: false,
            endedAt: new Date(),
            endAmount,
            endBalanceAmount: session.balance.balance,
            diff,
            outcome,
        });

        // Update user's balance with calculated endAmount
        if (session.balance) {
            this.logger.debug(
                `Updating balance from ${session.balance.balance} to ${endAmount} for session ${sessionId}`
            );

            wrap(session.balance).assign({
                balance: endAmount,
            });
        }

        await this.em.flush();

        this.logger.debug(`Closed session ${sessionId} successfully`);
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
            { populate: ['balance', 'user.site', 'game.subProvider.provider.id'] }
        );
    }

    /**
     * Calculates profit or loss for a game session based on transactions
     * @param sessionUuid - The UUID of the game session
     * @returns Object containing profit/loss calculation details
     */
    async calculateSessionProfitLoss(sessionUuid: string): Promise<{
        sessionId: number;
        sessionUuid: string;
        totalDeposits: number;
        totalWithdraws: number;
        profitLoss: number;
        outcome: 'profit' | 'loss' | 'breakeven';
        transactionCount: number;
        depositCount: number;
        withdrawCount: number;
    }> {
        this.logger.debug(`Calculating profit/loss for session ${sessionUuid}`);

        // Fetch session with transactions
        const session = await this.em.findOne(
            GameSession,
            { uuid: sessionUuid },
            { populate: ['transactions'] }
        );

        if (!session) {
            throw new Error(`Session not found: ${sessionUuid}`);
        }

        // Initialize counters
        let totalDeposits = 0;
        let totalWithdraws = 0;
        let depositCount = 0;
        let withdrawCount = 0;

        // Calculate totals from transactions
        const transactions = session.transactions.getItems();

        for (const transaction of transactions) {
            // Skip canceled transactions
            if (transaction.isCanceled) {
                continue;
            }

            const amount = Number(transaction.amount);

            if (transaction.type === GameTransactionType.DEPOSIT) {
                totalDeposits += amount;
                depositCount++;
            } else if (transaction.type === GameTransactionType.WITHDRAW) {
                totalWithdraws += amount;
                withdrawCount++;
            }
        }

        // Calculate profit/loss
        // Profit/Loss = Total Withdraws (wins) - Total Deposits (bets)
        const profitLoss = totalWithdraws - totalDeposits;

        // Determine outcome
        let outcome: 'profit' | 'loss' | 'breakeven';
        if (profitLoss > 0) {
            outcome = 'profit';
        } else if (profitLoss < 0) {
            outcome = 'loss';
        } else {
            outcome = 'breakeven';
        }

        const result = {
            sessionId: session.id!,
            sessionUuid: session.uuid,
            totalDeposits,
            totalWithdraws,
            profitLoss,
            outcome,
            transactionCount: transactions.length,
            depositCount,
            withdrawCount,
        };

        this.logger.debug(
            `Session ${sessionUuid} profit/loss calculation: ${JSON.stringify(result)}`
        );

        return result;
    }

    /**
     * Calculates profit or loss for a game session by ID
     * @param sessionId - The ID of the game session
     * @returns Object containing profit/loss calculation details
     */
    async calculateSessionProfitLossById(sessionId: number): Promise<{
        sessionId: number;
        sessionUuid: string;
        totalDeposits: number;
        totalWithdraws: number;
        profitLoss: number;
        outcome: 'profit' | 'loss' | 'breakeven';
        transactionCount: number;
        depositCount: number;
        withdrawCount: number;
    }> {
        this.logger.debug(`Calculating profit/loss for session ID ${sessionId}`);

        // Fetch session with transactions
        const session = await this.em.findOne(
            GameSession,
            { id: sessionId },
            { populate: ['transactions'] }
        );

        if (!session) {
            throw new Error(`Session not found with ID: ${sessionId}`);
        }

        // Reuse the UUID-based method
        return this.calculateSessionProfitLoss(session.uuid);
    }

    /**
     * Calculates profit or loss for multiple game sessions
     * @param sessionUuids - Array of session UUIDs
     * @returns Array of profit/loss calculations for each session
     */
    async calculateMultipleSessionsProfitLoss(sessionUuids: string[]): Promise<Array<{
        sessionId: number;
        sessionUuid: string;
        totalDeposits: number;
        totalWithdraws: number;
        profitLoss: number;
        outcome: 'profit' | 'loss' | 'breakeven';
        transactionCount: number;
        depositCount: number;
        withdrawCount: number;
    }>> {
        this.logger.debug(
            `Calculating profit/loss for ${sessionUuids.length} sessions`
        );

        const results = await Promise.all(
            sessionUuids.map(uuid => this.calculateSessionProfitLoss(uuid))
        );

        return results;
    }

    /**
     * Calculates aggregate profit or loss for a user across all their sessions
     * @param userId - The user ID
     * @param startDate - Optional start date filter
     * @param endDate - Optional end date filter
     * @returns Aggregate profit/loss statistics
     */
    async calculateUserProfitLoss(
        userId: number,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        userId: number;
        totalSessions: number;
        totalDeposits: number;
        totalWithdraws: number;
        totalProfitLoss: number;
        averageProfitLossPerSession: number;
        winSessions: number;
        lossSessions: number;
        breakevenSessions: number;
    }> {
        this.logger.debug(`Calculating aggregate profit/loss for user ${userId}`);

        // Build query filters
        const filters: any = {
            user: { id: userId },
        };

        if (startDate || endDate) {
            filters.startedAt = {};
            if (startDate) {
                filters.startedAt.$gte = startDate;
            }
            if (endDate) {
                filters.startedAt.$lte = endDate;
            }
        }

        // Fetch all user sessions with transactions
        const sessions = await this.em.find(
            GameSession,
            filters,
            { populate: ['transactions'] }
        );

        // Initialize aggregate counters
        let totalDeposits = 0;
        let totalWithdraws = 0;
        let winSessions = 0;
        let lossSessions = 0;
        let breakevenSessions = 0;

        // Calculate for each session
        for (const session of sessions) {
            const transactions = session.transactions.getItems();
            let sessionDeposits = 0;
            let sessionWithdraws = 0;

            for (const transaction of transactions) {
                if (transaction.isCanceled) {
                    continue;
                }

                const amount = Number(transaction.amount);

                if (transaction.type === GameTransactionType.DEPOSIT) {
                    sessionDeposits += amount;
                    totalDeposits += amount;
                } else if (transaction.type === GameTransactionType.WITHDRAW) {
                    sessionWithdraws += amount;
                    totalWithdraws += amount;
                }
            }

            // Count session outcome based on this session's profit/loss
            const sessionProfitLoss = sessionWithdraws - sessionDeposits;
            if (sessionProfitLoss > 0) {
                winSessions++;
            } else if (sessionProfitLoss < 0) {
                lossSessions++;
            } else {
                breakevenSessions++;
            }
        }

        const totalProfitLoss = totalWithdraws - totalDeposits;
        const averageProfitLossPerSession = sessions.length > 0
            ? totalProfitLoss / sessions.length
            : 0;

        const result = {
            userId,
            totalSessions: sessions.length,
            totalDeposits,
            totalWithdraws,
            totalProfitLoss,
            averageProfitLossPerSession,
            winSessions,
            lossSessions,
            breakevenSessions,
        };

        this.logger.debug(
            `User ${userId} aggregate profit/loss: ${JSON.stringify(result)}`
        );

        return result;
    }
}
