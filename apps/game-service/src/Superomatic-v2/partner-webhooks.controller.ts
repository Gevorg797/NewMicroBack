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

    // Test endpoint to verify controller is working
    @Post('test')
    async test(@Body() data: any, @Headers() headers: any, @Req() req: any) {
        this.logger.log('=== TEST ENDPOINT CALLED ===');
        this.logger.log(`Method: ${req.method}`);
        this.logger.log(`URL: ${req.url}`);
        this.logger.log(`Headers:`, headers);
        this.logger.log(`Body:`, data);
        this.logger.log('=============================');

        return {
            message: 'Test endpoint working!',
            received: {
                method: req.method,
                url: req.url,
                headers,
                body: data
            }
        };
    }

    // Root endpoint to catch any request to /webhooks/superomatic
    @All()
    async root(@Body() data: any, @Headers() headers: any, @Req() req: any) {
        this.logger.log('=== ROOT WEBHOOK ENDPOINT HIT ===');
        this.logger.log(`Method: ${req.method}`);
        this.logger.log(`URL: ${req.url}`);
        this.logger.log(`Headers:`, headers);
        this.logger.log(`Body:`, data);
        this.logger.log('===================================');

        return {
            message: 'Root webhook endpoint working!',
            path: req.url,
            method: req.method,
            timestamp: new Date().toISOString()
        };
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
        // Extract the endpoint by removing prefixes (/games, /webhooks/superomatic)
        let url = req.url;
        url = url.replace('/games/webhooks/superomatic', ''); // Full path with global prefix
        url = url.replace('/webhooks/superomatic', ''); // Without global prefix
        url = url.replace('/games', ''); // Direct call with just global prefix

        this.logger.log(`Extracted endpoint: "${url}" from original URL: "${req.url}"`);

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

    // Individual route handlers (called by catchAll)
    private async checkSession(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkSession(data, headers);
    }

    private async checkBalance(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkBalance(data, headers);
    }

    private async withdrawBet(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.withdrawBet(data, headers);
    }

    private async depositWin(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.depositWin(data, headers);
    }

    private async cancelTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.cancelTransaction(data, headers);
    }

    private async completeTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.completeTransaction(data, headers);
    }
}
