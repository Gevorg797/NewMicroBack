import { Controller, Body, Headers, Logger, All, Req } from '@nestjs/common';
import { PartnerWebhooksService } from './partner-webhooks.service';

@Controller('webhooks/superomatic')
export class PartnerWebhooksController {
    private readonly logger = new Logger(PartnerWebhooksController.name);

    constructor(private readonly partnerWebhooksService: PartnerWebhooksService) { }

    @All('*')
    async catchAll(@Body() data: any, @Headers() headers: any, @Req() req: any) {
        // Extract the endpoint by removing prefixes
        let url = req.url;
        url = url.replace('/games/webhooks/superomatic', '');
        url = url.replace('/webhooks/superomatic', '');
        url = url.replace('/games', '');

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
