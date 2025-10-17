import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { User, GameSession, GameTransaction, GameTransactionType, GameTransactionStatus } from '@lib/database';
import { wrap } from '@mikro-orm/core';
import * as crypto from 'crypto';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

@Injectable()
export class PartnerWebhooksService {
    private readonly logger = new LocalTimeLogger(PartnerWebhooksService.name);

    constructor(private readonly em: EntityManager) { }

    async checkSession(data: any, headers: any) {
        this.logger.log('Superomatic called /check-session', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract partner.session (our session ID)
        const partnerSession = parsedData['session'] || parsedData.session;

        if (!partnerSession) {
            throw new Error('Missing partner.session parameter');
        }

        // Single SQL query to get session data and check for other alive sessions
        const sessionId = parseInt(partnerSession);
        const sessionData = await this.em.getConnection().execute(
            `SELECT 
                gs.id,
                gs."is_alive" as "isAlive",
                gs."is_live" as "isLive",
                gs.denomination,
                gs."user_id" as "userId",
                g.uuid as "gameUuid",
                b.balance,
                c.name as "currencyName",
                (SELECT id FROM "gameSessions" 
                 WHERE "user_id" = gs."user_id" 
                   AND "is_alive" = true 
                   AND id != gs.id 
                 LIMIT 1) as "otherAliveSessionId"
             FROM "gameSessions" gs
             INNER JOIN games g ON gs."game_id" = g.id
             INNER JOIN balances b ON gs."balance_id" = b.id
             INNER JOIN currencies c ON b."currency_id" = c.id
             WHERE gs.id = ?
             LIMIT 1`,
            [sessionId]
        );


        if (!sessionData || sessionData.length === 0) {
            throw new Error(`Session not found: ${partnerSession}`);
        }

        const session = sessionData[0];

        if (!session.isLive) {
            throw new Error(`Session is not live: ${partnerSession}`);
        }

        if (session.otherAliveSessionId) {
            throw new Error(`User already has an active session: ${session.otherAliveSessionId}`);
        }

        // Convert denomination from string (e.g., "1.00") to cents (e.g., 100)
        const denominationInCents = Math.round(parseFloat(session.denomination || '1.00') * 100);

        // Convert balance from decimal to cents
        const balanceInCents = Math.round(parseFloat(session.balance) * 100);

        // Return response in Superomatic format
        return {
            method: 'check.session',
            status: 200,
            response: {
                id_player: session.userId, // immutable player id
                game_id: parseInt(session.gameUuid), // Superomatic's game id
                currency: session.currencyName, // currency code
                balance: balanceInCents, // balance in cents
                denomination: denominationInCents // denomination in cents
            }
        };
    }

    async checkBalance(data: any, headers: any) {
        this.logger.log('Superomatic called /check-balance', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract required parameters
        const session = parsedData['@session'] || parsedData.session;
        const currency = parsedData['@currency'] || parsedData.currency;
        const sign = parsedData['@sign'] || parsedData.sign;
        const meta = parsedData['@meta'] || parsedData.meta;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
        }

        // Single SQL query to get session data
        const sessionId = parseInt(session);
        const sessionData = await this.em.getConnection().execute(
            `SELECT 
                gs.id,
                gs."is_live" as "isLive",
                gs."user_id" as "userId",
                b.balance,
                c.name as "currencyName"
             FROM "gameSessions" gs
             INNER JOIN balances b ON gs."balance_id" = b.id
             INNER JOIN currencies c ON b."currency_id" = c.id
             WHERE gs.id = ?
             LIMIT 1`,
            [sessionId]
        );

        if (!sessionData || sessionData.length === 0) {
            throw new Error(`Session not found: ${session}`);
        }

        const gameSession = sessionData[0];

        if (!gameSession.isLive) {
            throw new Error(`Session is not active: ${session}`);
        }

        // Verify currency matches the session's currency
        if (gameSession.currencyName !== currency) {
            throw new Error(`Currency mismatch. Expected: ${gameSession.currencyName}, Got: ${currency}`);
        }

        // Convert balance from decimal to cents (Long format)
        const balanceInCents = Math.round(parseFloat(gameSession.balance) * 100);

        // Return response in Superomatic format
        return {
            method: 'check.balance',
            status: 200,
            response: {
                currency: currency,           // requested currency
                balance: balanceInCents       // player's balance in cents
            }
        };
    }

    async withdrawBet(data: any, headers: any) {
        this.logger.log('Superomatic called /withdraw-bet', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract required parameters
        const session = parsedData['@session'] || parsedData.session;
        const currency = parsedData['@currency'] || parsedData.currency;
        const amountInCents = parseInt(parsedData['@amount'] || parsedData.amount || '0');
        const trxId = parsedData['@trx_id'] || parsedData.trx_id;
        const sign = parsedData['@sign'] || parsedData.sign;
        const turnId = parsedData['@turn_id'] || parsedData.turn_id;
        const meta = parsedData['@meta'] || parsedData.meta;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
        }

        if (!amountInCents || amountInCents <= 0) {
            throw new Error('Invalid @amount parameter');
        }

        if (!trxId) {
            throw new Error('Missing @trx_id parameter');
        }

        // Find the session in the database with balance relationship
        const gameSession = await this.em.findOne(
            GameSession,
            { id: parseInt(session) },
            {
                populate: ['balance', 'balance.currency']
            }
        );

        if (!gameSession) {
            throw new Error(`Session not found: ${session}`);
        }

        if (!gameSession.isAlive) {
            throw new Error(`Session is not active: ${session}`);
        }

        // Verify currency matches the session's currency
        if (gameSession.balance.currency.name !== currency) {
            throw new Error(`Currency mismatch. Expected: ${gameSession.balance.currency.name}, Got: ${currency}`);
        }

        // Convert amount from cents to decimal
        const amountInDecimal = amountInCents / 100;

        // Check if player has sufficient balance
        if (gameSession.balance.balance < amountInDecimal) {
            throw new Error(`Insufficient balance. Available: ${gameSession.balance.balance}, Required: ${amountInDecimal}`);
        }

        // // Check for duplicate transaction
        // const existingTransaction = await this.em.findOne(GameTransaction, {
        //     // Assuming we store trx_id in metadata or add it as a field
        //     // For now, we'll check by amount and session to prevent duplicates
        //     session: gameSession,
        //     amount: amountInDecimal,
        //     type: GameTransactionType.WITHDRAW
        // });

        // if (existingTransaction) {
        //     this.logger.warn(`Duplicate transaction detected: ${trxId}`);
        //     throw new Error(`Transaction ${trxId} already processed`);
        // }

        // Start transaction to ensure atomicity
        await this.em.transactional(async (em) => {
            // Create game transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.WITHDRAW,
                amount: amountInDecimal,
                trxId: trxId,
                metadata: { ...parsedData }
            });
            await em.persistAndFlush(transaction);

            // Update player's balance
            wrap(gameSession.balance).assign({
                balance: gameSession.balance.balance - amountInDecimal
            });
            await em.flush();

            this.logger.log(`Successfully withdrew ${amountInDecimal} from session ${session}. Transaction ID: ${transaction.id}`);
        });

        // Get updated balance in cents
        const updatedBalanceInCents = Math.round(gameSession.balance.balance * 100);

        // Return response in Superomatic format
        return {
            method: 'withdraw.bet',
            status: 200,
            response: {
                currency: currency,           // requested currency
                balance: updatedBalanceInCents // player's balance in cents after withdrawal
            }
        };
    }

    async depositWin(data: any, headers: any) {
        this.logger.log('Superomatic called /deposit-win', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract required parameters
        const session = parsedData['@session'] || parsedData.session;
        const currency = parsedData['@currency'] || parsedData.currency;
        const amountInCents = parseInt(parsedData['@amount'] || parsedData.amount || '0');
        const trxId = parsedData['@trx_id'] || parsedData.trx_id;
        const sign = parsedData['@sign'] || parsedData.sign;
        const turnId = parsedData['@turn_id'] || parsedData.turn_id;
        const meta = parsedData['@meta'] || parsedData.meta;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
        }

        if (amountInCents === undefined || amountInCents === null || isNaN(amountInCents) || amountInCents < 0) {
            throw new Error('Invalid @amount parameter');
        }

        if (!trxId) {
            throw new Error('Missing @trx_id parameter');
        }

        // Find the session in the database with balance relationship
        const gameSession = await this.em.findOne(
            GameSession,
            { id: parseInt(session) },
            {
                populate: ['balance', 'balance.currency']
            }
        );

        if (!gameSession) {
            throw new Error(`Session not found: ${session}`);
        }

        if (!gameSession.isLive) {
            throw new Error(`Session is not active: ${session}`);
        }

        // Verify currency matches the session's currency
        if (gameSession.balance.currency.name !== currency) {
            throw new Error(`Currency mismatch. Expected: ${gameSession.balance.currency.name}, Got: ${currency}`);
        }

        // Convert amount from cents to decimal
        const amountInDecimal = amountInCents / 100;

        // If amount is 0, just return current balance (no win scenario)
        if (amountInCents === 0) {
            const currentBalanceInCents = Math.round(gameSession.balance.balance * 100);
            this.logger.log(`No win for session ${session}. Transaction ID: ${trxId}`);

            return {
                method: 'deposit.win',
                status: 200,
                response: {
                    currency: currency,
                    balance: currentBalanceInCents
                }
            };
        }

        // Check for duplicate transaction
        // const existingTransaction = await this.em.findOne(GameTransaction, {
        //     // Check by amount and session to prevent duplicates
        //     session: gameSession,
        //     amount: amountInDecimal,
        //     type: GameTransactionType.DEPOSIT
        // });

        // if (existingTransaction) {
        //     this.logger.warn(`Duplicate transaction detected: ${trxId}`);
        //     throw new Error(`Transaction ${trxId} already processed`);
        // }

        // Start transaction to ensure atomicity
        await this.em.transactional(async (em) => {
            // Create game transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.DEPOSIT,
                trxId: trxId,
                amount: amountInDecimal,
                metadata: { ...parsedData }
            });
            await em.persistAndFlush(transaction);

            // Update player's balance
            wrap(gameSession.balance).assign({
                balance: gameSession.balance.balance + amountInDecimal
            });
            await em.flush();

            this.logger.log(`Successfully deposited ${amountInDecimal} to session ${session}. Transaction ID: ${transaction.id}`);
        });

        // Get updated balance in cents
        const updatedBalanceInCents = Math.round(gameSession.balance.balance * 100);

        // Return response in Superomatic format
        return {
            method: 'deposit.win',
            status: 200,
            response: {
                currency: currency,           // requested currency
                balance: updatedBalanceInCents // player's balance in cents after deposit
            }
        };
    }

    async cancelTransaction(data: any, headers: any) {
        this.logger.log('Superomatic called /trx-cancel', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract required parameters
        const session = parsedData['@session'] || parsedData.session;
        const currency = parsedData['@currency'] || parsedData.currency;
        const trxId = parsedData['@trx_id'] || parsedData.trx_id;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
        }

        if (!trxId) {
            throw new Error('Missing @trx_id parameter');
        }

        // Find the session in the database with balance relationship
        const gameSession = await this.em.findOne(
            GameSession,
            { id: parseInt(session) },
            {
                populate: ['balance', 'balance.currency', 'user']
            }
        );

        if (!gameSession) {
            throw new Error(`Session not found: ${session}`);
        }

        // Verify currency matches the session's currency
        if (gameSession.balance.currency.name !== currency) {
            throw new Error(`Currency mismatch. Expected: ${gameSession.balance.currency.name}, Got: ${currency}`);
        }

        // Find the transaction to cancel by trx_id
        const transactionToCancel = await this.em.findOne(GameTransaction, {
            trxId: trxId,
            session: gameSession
        });

        if (!transactionToCancel) {
            throw new Error(`Transaction not found to cancel: ${trxId}`);
        }

        // Get current balance in cents
        let balanceInCents = Math.round(gameSession.balance.balance * 100);

        // If transaction is already cancelled/completed, return current balance
        if (transactionToCancel.status === GameTransactionStatus.COMPLETED || transactionToCancel.isCanceled) {
            this.logger.log(`Transaction ${trxId} already cancelled. Returning current balance.`);
            return {
                method: 'trx.cancel',
                status: 200,
                response: {
                    currency: currency,
                    balance: balanceInCents
                }
            };
        }

        // Start transaction to ensure atomicity
        await this.em.transactional(async (em) => {
            // For WITHDRAW transactions, revert by adding the amount back to balance
            if (transactionToCancel.type === GameTransactionType.WITHDRAW && transactionToCancel.amount > 0) {
                const refundAmount = transactionToCancel.amount;

                this.logger.log(`Cancelling withdraw transaction ${trxId}. Refunding ${refundAmount} to balance`);

                // Revert the withdrawal by adding the amount back
                wrap(gameSession.balance).assign({
                    balance: gameSession.balance.balance + refundAmount
                });

                await em.flush();
            }

            // Mark the transaction as cancelled
            wrap(transactionToCancel).assign({
                status: GameTransactionStatus.COMPLETED,
                isCanceled: true,
                deletedAt: new Date()
            });

            await em.flush();

            this.logger.log(`Successfully cancelled transaction ${trxId} for session ${session}`);
        });

        // Get updated balance in cents
        balanceInCents = Math.round(gameSession.balance.balance * 100);

        // Return response in Superomatic format
        return {
            method: 'trx.cancel',
            status: 200,
            response: {
                currency: currency,
                balance: balanceInCents
            }
        };
    }

    async completeTransaction(data: any, headers: any) {
        this.logger.log('Superomatic called /trx-complete', { data, headers });

        // Parse data if it's a string (Superomatic sends as text/plain)
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Extract required parameters
        const session = parsedData['@session'] || parsedData.session;
        const currency = parsedData['@currency'] || parsedData.currency;
        const trxId = parsedData['@trx_id'] || parsedData.trx_id;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
        }

        if (!trxId) {
            throw new Error('Missing @trx_id parameter');
        }

        // Find the session in the database with balance relationship
        const gameSession = await this.em.findOne(
            GameSession,
            { id: parseInt(session) },
            {
                populate: ['balance', 'balance.currency', 'user']
            }
        );

        if (!gameSession) {
            throw new Error(`Session not found: ${session}`);
        }

        // Verify currency matches the session's currency
        if (gameSession.balance.currency.name !== currency) {
            throw new Error(`Currency mismatch. Expected: ${gameSession.balance.currency.name}, Got: ${currency}`);
        }

        // Find the transaction by trx_id
        const transaction = await this.em.findOne(GameTransaction, {
            trxId: trxId,
            session: gameSession
        });

        if (!transaction) {
            throw new Error(`Transaction ${trxId} not found`);
        }

        // Get current balance in cents
        let balanceInCents = Math.round(gameSession.balance.balance * 100);

        // If transaction status is already COMPLETED, return current balance
        if (transaction.status === GameTransactionStatus.COMPLETED) {
            this.logger.log(`Transaction ${trxId} already completed. Returning current balance.`);
            return {
                method: 'trx.complete',
                status: 200,
                response: {
                    currency: currency,
                    balance: balanceInCents
                }
            };
        }

        // If transaction is DEPOSIT with amount > 0, rollback by decreasing balance
        await this.em.transactional(async (em) => {
            if (transaction.type === GameTransactionType.DEPOSIT && transaction.amount > 0) {
                const rollbackAmount = transaction.amount;

                this.logger.log(`Rolling back deposit transaction ${trxId}. Decreasing balance by ${rollbackAmount}`);

                // Decrease balance (rollback the deposit)
                wrap(gameSession.balance).assign({
                    balance: gameSession.balance.balance - rollbackAmount
                });

                await em.flush();
            }

            // Update transaction status to COMPLETED
            wrap(transaction).assign({
                status: GameTransactionStatus.COMPLETED
            });

            await em.flush();

            this.logger.log(`Transaction ${trxId} marked as completed for session ${session}`);
        });

        // Get updated balance in cents
        balanceInCents = Math.round(gameSession.balance.balance * 100);

        // Return response in Superomatic format
        return {
            method: 'trx.complete',
            status: 200,
            response: {
                currency: currency,
                balance: balanceInCents
            }
        };
    }

    // Helper methods for database operations
    private async getUserBalance(partnerSession: string, currency: string): Promise<number> {
        // TODO: Implement balance retrieval
        // Get user balance from database based on partnerSession
        this.logger.log(`Getting balance for session: ${partnerSession}, currency: ${currency}`);
        return 100000; // Placeholder - balance in cents
    }

    private async withdrawFromBalance(partnerSession: string, amount: number, currency: string, trxId: string): Promise<number> {
        // TODO: Implement balance withdrawal
        // 1. Check if user has sufficient balance
        // 2. Withdraw amount from balance
        // 3. Log transaction
        // 4. Return new balance
        this.logger.log(`Withdrawing ${amount} from ${partnerSession} for transaction ${trxId}`);
        return 99000; // Placeholder - new balance in cents
    }

    private async depositToBalance(partnerSession: string, amount: number, currency: string, trxId: string): Promise<number> {
        // TODO: Implement balance deposit
        // 1. Add amount to balance
        // 2. Log transaction
        // 3. Return new balance
        this.logger.log(`Depositing ${amount} to ${partnerSession} for transaction ${trxId}`);
        return 101000; // Placeholder - new balance in cents
    }

    private async cancelTransactionInDb(trxId: string): Promise<void> {
        // TODO: Implement transaction cancellation in database
        this.logger.log(`Cancelling transaction: ${trxId}`);
    }

    private async completeTransactionInDb(trxId: string): Promise<void> {
        // TODO: Implement transaction completion in database
        this.logger.log(`Completing transaction: ${trxId}`);
    }

    // Helper method to validate Superomatic signature
    private validateSignature(data: any, signature: string, secretKey: string): boolean {
        // TODO: Implement signature validation
        // This should match the signature generation logic from Superomatic
        const expectedSignature = crypto
            .createHash('md5')
            .update(JSON.stringify(data) + secretKey)
            .digest('hex');

        return signature === expectedSignature;
    }
}
