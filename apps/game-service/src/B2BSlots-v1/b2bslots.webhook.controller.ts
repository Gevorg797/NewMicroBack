import { Controller, Body, Headers, Logger, All, Req, HttpCode, HttpStatus } from '@nestjs/common';
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

    @All('*')
    @HttpCode(HttpStatus.OK)
    async catchAll(
        @Body() payload: B2BSlotsWebhookPayload,
        @Headers() headers: any,
        @Req() req: any,
    ) {
        // Normalize URL similar to superomatic controller
        let url = req.url as string;

        url = url.replace('/games/webhooks/b2bslots', '');
        url = url.replace('/webhooks/b2bslots', '');
        url = url.replace('/games', '');

        this.logger.debug(`B2BSlots webhook request to endpoint: ${url} for user: ${payload?.data?.user_id}`);

        switch (url) {
            case '/auth':
                return this.handleAuthWebhook(payload, headers);
            case '/debit':
                return this.handleDebitWebhook(payload, headers);
            case '/credit':
                return this.handleCreditWebhook(payload, headers);
            case '/get-features':
                return this.handleGetFeaturesWebhook(payload, headers);
            case '/activate-features':
                return this.handleActivateFeaturesWebhook(payload, headers);
            case '/update-features':
                return this.handleUpdateFeaturesWebhook(payload, headers);
            case '/end-features':
                return this.handleEndFeaturesWebhook(payload, headers);
            default:
                this.logger.error(`Unknown B2BSlots webhook endpoint: ${url}`);
                throw new Error(`Unknown B2BSlots webhook endpoint: ${url}`);
        }
    }

    private async handleAuthWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots auth webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processAuthWebhook(payload);
    }

    private async handleDebitWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots debit webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processDebitWebhook(payload);
    }

    private async handleCreditWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots credit webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processCreditWebhook(payload);
    }

    private async handleGetFeaturesWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots get features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processGetFeaturesWebhook(payload);
    }

    private async handleActivateFeaturesWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots activate features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processActivateFeaturesWebhook(payload);
    }

    private async handleUpdateFeaturesWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots update features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processUpdateFeaturesWebhook(payload);
    }

    private async handleEndFeaturesWebhook(payload: B2BSlotsWebhookPayload, headers: any) {
        this.logger.debug(`Received B2BSlots end features webhook for user: ${payload.data.user_id}`);
        return this.webhookService.processEndFeaturesWebhook(payload);
    }
}
