import { Controller, Post, Body, Headers, Logger, All, Req } from '@nestjs/common';
import { PartnerWebhooksService } from './partner-webhooks.service';

@Controller('webhooks/superomatic')
export class PartnerWebhooksController {
    private readonly logger = new Logger(PartnerWebhooksController.name);

    constructor(private readonly partnerWebhooksService: PartnerWebhooksService) { }

    // Health check endpoint
    @Post('health')
    async health() {
        this.logger.log('Health check endpoint called');
        return { status: 'ok', timestamp: new Date().toISOString() };
    }

    // Catch-all route for debugging - log ALL requests to this controller
    @All('*')
    async catchAll(@Body() data: any, @Headers() headers: any, @Req() req: any) {
        this.logger.log(`=== WEBHOOK REQUEST RECEIVED ===`);
        this.logger.log(`Method: ${req.method}`);
        this.logger.log(`URL: ${req.url}`);
        this.logger.log(`Headers:`, headers);
        this.logger.log(`Body:`, data);
        this.logger.log(`================================`);

        // Route to appropriate method based on URL
        const url = req.url.replace('/webhooks/superomatic', '');
        switch (url) {
            case '/check.session':
                return this.checkSession(data, headers);
            case '/check.balance':
                return this.checkBalance(data, headers);
            case '/withdraw.bet':
                return this.withdrawBet(data, headers);
            case '/deposit.win':
                return this.depositWin(data, headers);
            case '/trx.cancel':
                return this.cancelTransaction(data, headers);
            case '/trx.complete':
                return this.completeTransaction(data, headers);
            default:
                this.logger.error(`Unknown webhook endpoint: ${url}`);
                throw new Error(`Unknown webhook endpoint: ${url}`);
        }
    }

    @Post('check.session')
    async checkSession(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkSession(data, headers);
    }

    @Post('check.balance')
    async checkBalance(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkBalance(data, headers);
    }

    @Post('withdraw.bet')
    async withdrawBet(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.withdrawBet(data, headers);
    }

    @Post('deposit.win')
    async depositWin(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.depositWin(data, headers);
    }

    @Post('trx.cancel')
    async cancelTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.cancelTransaction(data, headers);
    }

    @Post('trx.complete')
    async completeTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.completeTransaction(data, headers);
    }
}
