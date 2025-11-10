import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameSession, GameTransaction, GameTransactionType, GameFreeSpin, BalanceType } from '@lib/database';
import { wrap } from '@mikro-orm/core';
import * as crypto from 'crypto';

interface B2BSlotsWebhookPayload {
    api: string;
    data: {
        user_id: string;
        user_ip?: string;
        user_game_token?: string;
        user_auth_token?: string;
        currency: string;
        game_code?: number;
        game_name?: string;
        transaction_id?: string;
        turn_id?: number;
        round_id?: number;
        debit_amount?: string;
        credit_amount?: string;
        credit_type?: string;
        free_rounds?: {
            id?: number;
            count?: number;
            bet?: number;
            lines?: number;
            mpl?: number;
            cp?: string;
            version?: number;
            win?: string;
            round_win?: string;
            played?: number;
        };
    };
    signature?: string;  // B2BSlots webhook signature
    timestamp?: string;  // Request timestamp
    success?: boolean;
    answer?: {
        operator_id?: number;
        transaction_id?: string;
        user_id?: string;
        user_nickname?: string;
        balance?: string;
        bonus_balance?: string;
        bonus_amount?: string;
        game_token?: string;
        error_code?: number;
        error_description?: string;
        currency?: string;
        timestamp?: string;
    };
}

@Injectable()
export class B2BSlotsWebhookService {
    private readonly logger = new Logger(B2BSlotsWebhookService.name);

    // B2BSlots webhook security settings
    private readonly webhookSecret = process.env.B2BSLOTS_WEBHOOK_SECRET || 'your-webhook-secret';
    private readonly allowedIPs = process.env.B2BSLOTS_ALLOWED_IPS?.split(',') || ['127.0.0.1'];
    private readonly timestampTolerance = 300; // 5 minutes in seconds
    private readonly operatorId = parseInt(process.env.B2BSLOTS_OPERATOR_ID || '0');

    constructor(private readonly em: EntityManager) { }

    /**
     * Validate webhook authenticity
     */
    private validateWebhookAuth(payload: B2BSlotsWebhookPayload, clientIP?: string): void {
        // 1. Validate signature if provided
        if (payload.signature) {
            if (!this.verifySignature(payload)) {
                this.logger.error('Invalid webhook signature');
                throw new UnauthorizedException('Invalid webhook signature');
            }
        }

        // 2. Validate timestamp to prevent replay attacks
        if (payload.timestamp) {
            if (!this.validateTimestamp(payload.timestamp)) {
                this.logger.error('Webhook timestamp is too old or invalid');
                throw new UnauthorizedException('Request timestamp is invalid');
            }
        }

        // 3. Validate IP address if provided
        if (clientIP && !this.allowedIPs.includes(clientIP)) {
            this.logger.error(`Unauthorized IP address: ${clientIP}`);
            throw new UnauthorizedException('IP address not allowed');
        }

        // 4. Validate required fields
        if (!payload.data || !payload.data.user_id || !payload.data.currency) {
            this.logger.error('Missing required webhook fields');
            throw new BadRequestException('Missing required fields');
        }
    }

    /**
     * Verify webhook signature using HMAC
     */
    private verifySignature(payload: B2BSlotsWebhookPayload): boolean {
        try {
            // Create signature payload (adjust based on B2BSlots documentation)
            const signaturePayload = JSON.stringify(payload.data) + (payload.timestamp || '');

            // Generate expected signature
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(signaturePayload)
                .digest('hex');

            // Compare signatures (use timing-safe comparison)
            return crypto.timingSafeEqual(
                Buffer.from(payload.signature!, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            this.logger.error('Error verifying webhook signature', error);
            return false;
        }
    }

    /**
     * Validate timestamp to prevent replay attacks
     */
    private validateTimestamp(timestamp: string): boolean {
        try {
            const requestTime = parseInt(timestamp);
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDiff = Math.abs(currentTime - requestTime);

            return timeDiff <= this.timestampTolerance;
        } catch (error) {
            this.logger.error('Error validating timestamp', error);
            return false;
        }
    }

    /**
     * Process auth webhook - called when game is initialized
     */
    async processAuthWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing auth webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            // Extract session token from user_game_token or user_auth_token
            const sessionToken = payload.data.user_game_token || payload.data.user_auth_token;

            if (!sessionToken) {
                throw new BadRequestException('Missing session token');
            }

            // Find session by UUID (session token)
            const gameSession = await this.em.findOne(
                GameSession,
                { uuid: sessionToken },
                { populate: ['balance', 'balance.currency', 'user'] }
            );

            if (!gameSession) {
                throw new BadRequestException(`Session not found: ${sessionToken}`);
            }

            if (!gameSession.isAlive) {
                throw new BadRequestException(`Session is not active: ${sessionToken}`);
            }

            // Verify currency matches
            if (gameSession.balance.currency.name !== payload.data.currency) {
                throw new BadRequestException(`Currency mismatch. Expected: ${gameSession.balance.currency.name}, Got: ${payload.data.currency}`);
            }

            // Get session balance (only return balance related to this session)
            const sessionBalance = gameSession.balance.balance.toFixed(2);

            this.logger.debug('Successfully processed B2BSlots auth webhook');
            return {
                success: true,
                api: 'do-auth-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    user_id: payload.data.user_id,
                    user_nickname: gameSession.user.name || 'Player',
                    balance: sessionBalance,
                    bonus_balance: '0.00',
                    game_token: sessionToken,
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots auth webhook', error.stack);
            return {
                success: false,
                api: 'do-auth-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process debit webhook (bet/withdrawal)
     */
    async processDebitWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing debit webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleDebitOperation(payload);

            this.logger.debug('Successfully processed B2BSlots debit webhook');
            return {
                success: true,
                api: 'do-debit-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    transaction_id: payload.data.transaction_id,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance,
                    bonus_balance: result.bonusBalance,
                    bonus_amount: '0.00',
                    game_token: payload.data.user_game_token,
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots debit webhook', error.stack);
            return {
                success: false,
                api: 'do-debit-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process credit webhook (win/deposit)
     */
    async processCreditWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing credit webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleCreditOperation(payload);

            this.logger.debug('Successfully processed B2BSlots credit webhook');
            return {
                success: true,
                api: 'do-credit-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    transaction_id: payload.data.transaction_id,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance,
                    bonus_balance: result.bonusBalance,
                    bonus_amount: '0.00',
                    game_token: payload.data.user_game_token,
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots credit webhook', error.stack);
            return {
                success: false,
                api: 'do-credit-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process get features webhook
     */
    async processGetFeaturesWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing get features webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleGetFeaturesOperation(payload);

            this.logger.debug('Successfully processed B2BSlots get features webhook');
            return {
                success: true,
                api: 'do-get-features-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance || '0.00',
                    bonus_balance: result.bonusBalance || '0.00',
                    game_token: payload.data.user_game_token,
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    timestamp: Date.now().toString(),
                    free_rounds: result.freeRounds || {
                        id: 1,
                        count: 0,
                        bet: 0,
                        lines: 0,
                        mpl: 0,
                        cp: '1.00',
                        version: 1
                    }
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots get features webhook', error.stack);
            return {
                success: false,
                api: 'do-get-features-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process activate features webhook
     */
    async processActivateFeaturesWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing activate features webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleActivateFeaturesOperation(payload);

            this.logger.debug('Successfully processed B2BSlots activate features webhook');
            return {
                success: true,
                api: 'do-activate-features-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance || '0.00',
                    bonus_balance: result.bonusBalance || '0.00',
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    game_token: payload.data.user_game_token,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots activate features webhook', error.stack);
            return {
                success: false,
                api: 'do-activate-features-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process update features webhook
     */
    async processUpdateFeaturesWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing update features webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleUpdateFeaturesOperation(payload);

            this.logger.debug('Successfully processed B2BSlots update features webhook');
            return {
                success: true,
                api: 'do-update-features-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance || '0.00',
                    bonus_balance: result.bonusBalance || '0.00',
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    game_token: payload.data.user_game_token,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots update features webhook', error.stack);
            return {
                success: false,
                api: 'do-update-features-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process end features webhook
     */
    async processEndFeaturesWebhook(payload: B2BSlotsWebhookPayload, clientIP?: string) {
        this.logger.debug(`Processing end features webhook for user: ${payload.data.user_id}`);

        // Validate webhook authenticity
        this.validateWebhookAuth(payload, clientIP);

        try {
            const result = await this.handleEndFeaturesOperation(payload);

            this.logger.debug('Successfully processed B2BSlots end features webhook');
            return {
                success: true,
                api: 'do-end-features-user-ingame',
                answer: {
                    operator_id: this.operatorId,
                    user_id: payload.data.user_id,
                    user_nickname: result.name || 'Player',
                    balance: result.balance || '0.00',
                    bonus_balance: result.bonusBalance || '0.00',
                    error_code: 0,
                    error_description: 'ok',
                    currency: payload.data.currency,
                    game_token: payload.data.user_game_token,
                    timestamp: Date.now().toString()
                }
            };
        } catch (error) {
            this.logger.error('Failed to process B2BSlots end features webhook', error.stack);
            return {
                success: false,
                api: 'do-end-features-user-ingame',
                answer: {
                    error_code: 1,
                    error_description: error.message || 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Handle debit operation - withdraw bet amount from balance
     */
    private async handleDebitOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string }> {
        const sessionToken = payload.data.user_game_token;
        const debitAmount = parseFloat(payload.data.debit_amount || '0');
        const transactionId = payload.data.transaction_id;

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        if (!transactionId) {
            throw new BadRequestException('Missing transaction_id');
        }

        if (debitAmount <= 0) {
            throw new BadRequestException('Invalid debit amount');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'balance.currency', 'user'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        if (!gameSession.isAlive) {
            throw new BadRequestException(`Session is not active: ${sessionToken}`);
        }

        // Verify currency
        if (gameSession.balance.currency.name !== payload.data.currency) {
            throw new BadRequestException(`Currency mismatch`);
        }

        // Check sufficient balance
        if (gameSession.balance.balance < debitAmount) {
            throw new BadRequestException(`Insufficient balance`);
        }

        // Process transaction atomically
        await this.em.transactional(async (em) => {
            // Create transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.WITHDRAW,
                amount: debitAmount,
                trxId: transactionId,
                metadata: { ...payload.data, webhook: 'debit' }
            });
            await em.persistAndFlush(transaction);

            // Update balance
            wrap(gameSession.balance).assign({
                balance: gameSession.balance.balance - debitAmount
            });
            await em.flush();

            this.logger.log(`Debit processed: ${debitAmount} ${payload.data.currency} from session ${sessionToken}`);
        });

        // Get updated session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player'
        };
    }

    /**
     * Handle credit operation - add win amount to balance
     */
    private async handleCreditOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string }> {
        const sessionToken = payload.data.user_game_token;
        const creditAmount = parseFloat(payload.data.credit_amount || '0');
        const transactionId = payload.data.transaction_id;

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        if (!transactionId) {
            throw new BadRequestException('Missing transaction_id');
        }

        if (creditAmount < 0) {
            throw new BadRequestException('Invalid credit amount');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'balance.currency', 'user'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        if (!gameSession.isAlive) {
            throw new BadRequestException(`Session is not active: ${sessionToken}`);
        }

        // Verify currency
        if (gameSession.balance.currency.name !== payload.data.currency) {
            throw new BadRequestException(`Currency mismatch`);
        }

        // If credit amount is 0, just return current balance (no win)
        if (creditAmount === 0) {
            this.logger.log(`No win for session ${sessionToken}`);
            const sessionBalance = gameSession.balance.balance.toFixed(2);
            return {
                balance: sessionBalance,
                bonusBalance: '0.00',
                name: gameSession.user.name || 'Player'
            };
        }

        // Process transaction atomically
        await this.em.transactional(async (em) => {
            // Create transaction record
            const transaction = new GameTransaction();
            wrap(transaction).assign({
                session: gameSession,
                type: GameTransactionType.DEPOSIT,
                amount: creditAmount,
                trxId: transactionId,
                metadata: { ...payload.data, webhook: 'credit' }
            });
            await em.persistAndFlush(transaction);

            // Update balance
            wrap(gameSession.balance).assign({
                balance: gameSession.balance.balance + creditAmount
            });
            await em.flush();

            this.logger.log(`Credit processed: ${creditAmount} ${payload.data.currency} to session ${sessionToken}`);
        });

        // Get updated session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player'
        };
    }

    /**
     * Handle get features operation - retrieve active free spins/rounds
     */
    private async handleGetFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string; freeRounds?: any }> {
        const sessionToken = payload.data.user_game_token;

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'balance.currency', 'user', 'freeSpins', 'game'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        // Get active free spins for this user and game
        const activeFreeSpins = await this.em.findOne(GameFreeSpin, {
            user: gameSession.user,
            game: gameSession.game,
            isActive: true,
            deletedAt: null
        });

        let freeRounds: any = null;
        if (activeFreeSpins) {
            freeRounds = {
                id: activeFreeSpins.id,
                count: activeFreeSpins.betCount,
                bet: parseFloat(activeFreeSpins.denomination),
                lines: 0,
                mpl: activeFreeSpins.weidger,
                cp: activeFreeSpins.bank,
                version: 1
            };
        }

        this.logger.debug(`Getting features for session ${sessionToken}: ${activeFreeSpins ? 'has free rounds' : 'no free rounds'}`);

        // Get session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player',
            freeRounds
        };
    }

    /**
     * Handle activate features operation - activate free rounds/spins
     */
    private async handleActivateFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string }> {
        const sessionToken = payload.data.user_game_token;
        const freeRoundsId = payload.data.free_rounds?.id;

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        if (!freeRoundsId) {
            throw new BadRequestException('Missing free_rounds.id');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'user', 'game'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        // Find and activate the free spins
        const freeSpin = await this.em.findOne(GameFreeSpin, {
            id: freeRoundsId,
            user: gameSession.user,
            isActive: true
        });

        if (!freeSpin) {
            throw new BadRequestException(`Free rounds not found: ${freeRoundsId}`);
        }

        // Activate free spins
        await this.em.transactional(async (em) => {
            wrap(freeSpin).assign({
                isActivated: true,
                activatedAt: new Date(),
                gameSession: gameSession
            });
            await em.flush();

            this.logger.log(`Activated free rounds ${freeRoundsId} for session ${sessionToken}`);
        });

        // Get session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player'
        };
    }

    /**
     * Handle update features operation - update free rounds progress
     */
    private async handleUpdateFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string }> {
        const sessionToken = payload.data.user_game_token;
        const freeRoundsId = payload.data.free_rounds?.id;
        const roundWin = parseFloat(payload.data.free_rounds?.round_win || '0');

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        if (!freeRoundsId) {
            throw new BadRequestException('Missing free_rounds.id');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'balance.currency', 'user'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        // Find the free spins
        const freeSpin = await this.em.findOne(GameFreeSpin, {
            id: freeRoundsId,
            user: gameSession.user
        });

        if (!freeSpin) {
            throw new BadRequestException(`Free rounds not found: ${freeRoundsId}`);
        }

        // Update progress and add wins to balance
        await this.em.transactional(async (em) => {
            // Update free spins bank with accumulated wins
            const currentBank = parseFloat(freeSpin.bank || '0');
            wrap(freeSpin).assign({
                bank: (currentBank + roundWin).toFixed(2)
            });

            // Add win to user balance
            if (roundWin > 0) {
                wrap(gameSession.balance).assign({
                    balance: gameSession.balance.balance + roundWin
                });
            }

            await em.flush();

            this.logger.log(`Updated free rounds ${freeRoundsId}: win=${roundWin}, new bank=${freeSpin.bank}`);
        });

        // Get session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player'
        };
    }

    /**
     * Handle end features operation - finalize free rounds
     */
    private async handleEndFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; bonusBalance: string; name: string }> {
        const sessionToken = payload.data.user_game_token;
        const freeRoundsId = payload.data.free_rounds?.id;
        const totalWin = parseFloat(payload.data.free_rounds?.win || '0');

        if (!sessionToken) {
            throw new BadRequestException('Missing user_game_token');
        }

        if (!freeRoundsId) {
            throw new BadRequestException('Missing free_rounds.id');
        }

        // Find session
        const gameSession = await this.em.findOne(
            GameSession,
            { uuid: sessionToken },
            { populate: ['balance', 'user'] }
        );

        if (!gameSession) {
            throw new BadRequestException(`Session not found: ${sessionToken}`);
        }

        // Find and deactivate the free spins
        const freeSpin = await this.em.findOne(GameFreeSpin, {
            id: freeRoundsId,
            user: gameSession.user
        });

        if (!freeSpin) {
            throw new BadRequestException(`Free rounds not found: ${freeRoundsId}`);
        }

        // End free spins
        await this.em.transactional(async (em) => {
            wrap(freeSpin).assign({
                isActive: false,
                deletedAt: new Date()
            });
            await em.flush();

            this.logger.log(`Ended free rounds ${freeRoundsId} with total win: ${totalWin}`);
        });

        // Get session balance (only return balance related to this session)
        const sessionBalance = gameSession.balance.balance.toFixed(2);

        return {
            balance: sessionBalance,
            bonusBalance: '0.00',
            name: gameSession.user.name || 'Player'
        };
    }
}
