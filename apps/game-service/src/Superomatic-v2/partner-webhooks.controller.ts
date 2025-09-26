import { Controller, Post, Body, Headers } from '@nestjs/common';
import { PartnerWebhooksService } from './partner-webhooks.service';

@Controller('partner-webhooks')
export class PartnerWebhooksController {
    constructor(private readonly partnerWebhooksService: PartnerWebhooksService) { }

    @Post('check-session')
    async checkSession(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkSession(data, headers);
    }

    @Post('check-balance')
    async checkBalance(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.checkBalance(data, headers);
    }

    @Post('withdraw-bet')
    async withdrawBet(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.withdrawBet(data, headers);
    }

    @Post('deposit-win')
    async depositWin(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.depositWin(data, headers);
    }

    @Post('trx-cancel')
    async cancelTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.cancelTransaction(data, headers);
    }

    @Post('trx-complete')
    async completeTransaction(@Body() data: any, @Headers() headers: any) {
        return this.partnerWebhooksService.completeTransaction(data, headers);
    }
}
