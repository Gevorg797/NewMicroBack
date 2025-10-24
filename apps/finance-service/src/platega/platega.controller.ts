import { Body, Controller, Headers, Post } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FINANCE_PATTERNS } from 'libs/config';
import { PlategaService } from './platega.service';

@Controller('platega')
export class PlategaController {
  constructor(private readonly plategaService: PlategaService) {}

  @MessagePattern(FINANCE_PATTERNS.PLATEGA_CREATE_PAYIN)
  async createPayin(@Payload() payload: any) {
    return this.plategaService.createPayinOrder(payload);
  }

  @MessagePattern(FINANCE_PATTERNS.PLATEGA_CREATE_PAYOUT)
  async createPayout(@Payload() payload: any) {
    return this.plategaService.createPayoutProcess(payload);
  }

  @Post('webhook')
  async handleCallback(@Body() body: any, @Headers() headers: any) {
    return this.plategaService.handleCallback({ body, headers });
  }
}





