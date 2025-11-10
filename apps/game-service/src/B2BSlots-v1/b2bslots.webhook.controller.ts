import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { B2BSlotsWebhookService } from './b2bslots.webhook.service';

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

@Controller('webhooks/b2bslots')
export class B2BSlotsWebhookController {
    private readonly logger = new Logger(B2BSlotsWebhookController.name);

    constructor(private readonly webhookService: B2BSlotsWebhookService) { }

    /**
     * Handle B2BSlots webhook for authentication operations
     */
    @Post('auth')
    @HttpCode(HttpStatus.OK)
    async handleAuthWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots auth webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processAuthWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for debit operations
     */
    @Post('debit')
    @HttpCode(HttpStatus.OK)
    async handleDebitWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots debit webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processDebitWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for credit operations
     */
    @Post('credit')
    @HttpCode(HttpStatus.OK)
    async handleCreditWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots credit webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processCreditWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for get features operations
     */
    @Post('get-features')
    @HttpCode(HttpStatus.OK)
    async handleGetFeaturesWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots get features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processGetFeaturesWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for activate features operations
     */
    @Post('activate-features')
    @HttpCode(HttpStatus.OK)
    async handleActivateFeaturesWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots activate features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processActivateFeaturesWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for update features operations
     */
    @Post('update-features')
    @HttpCode(HttpStatus.OK)
    async handleUpdateFeaturesWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots update features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processUpdateFeaturesWebhook(payload);
    }

    /**
     * Handle B2BSlots webhook for end features operations
     */
    @Post('end-features')
    @HttpCode(HttpStatus.OK)
    async handleEndFeaturesWebhook(@Body() payload: B2BSlotsWebhookPayload) {
        this.logger.debug(`Received B2BSlots end features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processEndFeaturesWebhook(payload);
    }
}
