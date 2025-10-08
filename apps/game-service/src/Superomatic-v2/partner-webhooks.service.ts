import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { User, GameSession, GameTransaction, GameTransactionType } from '@lib/database';
import { wrap } from '@mikro-orm/core';
import * as crypto from 'crypto';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

@Injectable()
export class PartnerWebhooksService {
    private readonly logger = new LocalTimeLogger(PartnerWebhooksService.name);

    constructor(private readonly em: EntityManager) { }

    async checkSession(data: any, headers: any) {
        this.logger.log('Superomatic called /check-session', { data, headers });

        // Extract partner.session (our session ID)
        const partnerSession = data['partner.session'] || data.partnerSession;

        if (!partnerSession) {
            throw new Error('Missing partner.session parameter');
        }

        // Find the session in the database with all required relationships
        const session = await this.em.findOne(
            GameSession,
            { id: parseInt(partnerSession) },
            {
                populate: ['user', 'game', 'balance', 'balance.currency']
            }
        );

        if (!session) {
            throw new Error(`Session not found: ${partnerSession}`);
        }

        if (!session.isAlive) {
            throw new Error(`Session is not active: ${partnerSession}`);
        }

        // Convert denomination from string (e.g., "1.00") to cents (e.g., 100)
        const denominationInCents = Math.round(parseFloat(session.denomination || '1.00') * 100);

        // Convert balance from decimal to cents
        const balanceInCents = Math.round(session.balance.balance * 100);

        // Return response in Superomatic format
        return {
            method: 'check.session',
            status: 200,
            response: {
                id_player: session.user.id, // immutable player id
                game_id: parseInt(session.game.uuid), // Superomatic's game id
                currency: session.balance.currency.name, // currency code
                balance: balanceInCents, // balance in cents
                denomination: denominationInCents // denomination in cents
            }
        };
    }

    async checkBalance(data: any, headers: any) {
        this.logger.log('Superomatic called /check-balance', { data, headers });

        // Extract required parameters
        const session = data['@session'] || data.session;
        const currency = data['@currency'] || data.currency;
        const sign = data['@sign'] || data.sign;
        const meta = data['@meta'] || data.meta;

        if (!session) {
            throw new Error('Missing @session parameter');
        }

        if (!currency) {
            throw new Error('Missing @currency parameter');
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

        // Convert balance from decimal to cents (Long format)
        const balanceInCents = Math.round(gameSession.balance.balance * 100);

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

        // Extract required parameters
        const session = data['@session'] || data.session;
        const currency = data['@currency'] || data.currency;
        const amountInCents = parseInt(data['@amount'] || data.amount || '0');
        const trxId = data['@trx_id'] || data.trx_id;
        const sign = data['@sign'] || data.sign;
        const turnId = data['@turn_id'] || data.turn_id;
        const meta = data['@meta'] || data.meta;

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

        // Check for duplicate transaction
        const existingTransaction = await this.em.findOne(GameTransaction, {
            // Assuming we store trx_id in metadata or add it as a field
            // For now, we'll check by amount and session to prevent duplicates
            session: gameSession,
            amount: amountInDecimal,
            type: GameTransactionType.WITHDRAW
        });

        if (existingTransaction) {
            this.logger.warn(`Duplicate transaction detected: ${trxId}`);
            throw new Error(`Transaction ${trxId} already processed`);
        }

        // Start transaction to ensure atomicity
        await this.em.transactional(async (em) => {
            // Create game transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.WITHDRAW,
                amount: amountInDecimal
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

        // Extract required parameters
        const session = data['@session'] || data.session;
        const currency = data['@currency'] || data.currency;
        const amountInCents = parseInt(data['@amount'] || data.amount || '0');
        const trxId = data['@trx_id'] || data.trx_id;
        const sign = data['@sign'] || data.sign;
        const turnId = data['@turn_id'] || data.turn_id;
        const meta = data['@meta'] || data.meta;

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

        // Check for duplicate transaction
        const existingTransaction = await this.em.findOne(GameTransaction, {
            // Check by amount and session to prevent duplicates
            session: gameSession,
            amount: amountInDecimal,
            type: GameTransactionType.DEPOSIT
        });

        if (existingTransaction) {
            this.logger.warn(`Duplicate transaction detected: ${trxId}`);
            throw new Error(`Transaction ${trxId} already processed`);
        }

        // Start transaction to ensure atomicity
        await this.em.transactional(async (em) => {
            // Create game transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.DEPOSIT,
                amount: amountInDecimal
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

        // TODO: Implement transaction cancellation logic
        // 1. Validate the signature from Superomatic
        // 2. Cancel the transaction in your database
        // 3. Return transaction status

        const trxId = data['trx.id'] || data.trxId;

        // Cancel transaction in database
        await this.cancelTransactionInDb(trxId);

        return {
            status: 'ok',
            transaction: {
                id: trxId,
                status: 'cancelled'
            }
        };
    }

    async completeTransaction(data: any, headers: any) {
        this.logger.log('Superomatic called /trx-complete', { data, headers });

        // TODO: Implement transaction completion logic
        // 1. Validate the signature from Superomatic
        // 2. Mark transaction as completed in your database
        // 3. Return transaction status

        const trxId = data['trx.id'] || data.trxId;

        // Complete transaction in database
        await this.completeTransactionInDb(trxId);

        return {
            status: 'ok',
            transaction: {
                id: trxId,
                status: 'completed'
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
