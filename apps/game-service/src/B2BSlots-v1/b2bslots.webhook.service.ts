import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

interface B2BSlotsWebhookPayload {
    api: string;
    data: {
        user_id: string;
        user_ip?: string;
        user_game_token?: string;
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
     * Process debit webhook
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
                    operator_id: 0,
                    transaction_id: payload.data.transaction_id,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Process credit webhook
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
                    operator_id: 0,
                    transaction_id: payload.data.transaction_id,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
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
                    operator_id: 0,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
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
                    operator_id: 0,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
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
                    operator_id: 0,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
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
                    operator_id: 0,
                    user_id: payload.data.user_id,
                    user_nickname: 'Anonymous',
                    balance: result.balance || '0.00',
                    bonus_balance: '0.00',
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
                    error_description: 'Internal server error',
                    timestamp: Date.now().toString()
                }
            };
        }
    }

    /**
     * Handle debit operation - implement your business logic here
     */
    private async handleDebitOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string }> {
        // TODO: Implement debit processing logic
        // - Validate transaction
        // - Update user balance
        // - Log transaction
        // - Handle errors

        this.logger.debug(`Processing debit: ${payload.data.debit_amount} ${payload.data.currency}`);

        // Placeholder implementation
        return {
            balance: '1000.00' // Return updated balance
        };
    }

    /**
     * Handle credit operation - implement your business logic here
     */
    private async handleCreditOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string }> {
        // TODO: Implement credit processing logic
        // - Validate transaction
        // - Update user balance
        // - Log transaction
        // - Handle errors

        this.logger.debug(`Processing credit: ${payload.data.credit_amount} ${payload.data.currency}`);

        // Placeholder implementation
        return {
            balance: '1000.00' // Return updated balance
        };
    }

    /**
     * Handle get features operation - implement your business logic here
     */
    private async handleGetFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string; freeRounds?: any }> {
        // TODO: Implement get features logic
        // - Check available free rounds
        // - Return feature information

        this.logger.debug(`Getting features for user: ${payload.data.user_id}`);

        // Placeholder implementation
        return {
            balance: '1000.00',
            freeRounds: {
                id: 1,
                count: 10,
                bet: 5,
                lines: 10,
                mpl: 2,
                cp: '1.00',
                version: 2
            }
        };
    }

    /**
     * Handle activate features operation - implement your business logic here
     */
    private async handleActivateFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string }> {
        // TODO: Implement activate features logic
        // - Activate free rounds
        // - Update user balance
        // - Log activation

        this.logger.debug(`Activating features for user: ${payload.data.user_id}`);

        // Placeholder implementation
        return {
            balance: '1000.00'
        };
    }

    /**
     * Handle update features operation - implement your business logic here
     */
    private async handleUpdateFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string }> {
        // TODO: Implement update features logic
        // - Update free rounds progress
        // - Handle wins
        // - Update counters

        this.logger.debug(`Updating features for user: ${payload.data.user_id}`);

        // Placeholder implementation
        return {
            balance: '1000.00'
        };
    }

    /**
     * Handle end features operation - implement your business logic here
     */
    private async handleEndFeaturesOperation(payload: B2BSlotsWebhookPayload): Promise<{ balance: string }> {
        // TODO: Implement end features logic
        // - End free rounds
        // - Finalize wins
        // - Update balance

        this.logger.debug(`Ending features for user: ${payload.data.user_id}`);

        // Placeholder implementation
        return {
            balance: '1000.00'
        };
    }
}
