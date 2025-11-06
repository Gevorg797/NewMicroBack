import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FINANCE_PATTERNS } from 'libs/config';
import { OpsService } from './ops.service';

@ApiTags('ops')
@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @MessagePattern(FINANCE_PATTERNS.OPS_CREATE_PAYIN)
  async createPayin(@Payload() payload: any) {
    return this.opsService.createPayinOrder(payload);
  }

  @MessagePattern(FINANCE_PATTERNS.OPS_CREATE_PAYOUT)
  async createPayout(@Payload() payload: any) {
    return this.opsService.createPayoutProcess(payload);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Ops webhook callback' })
  @ApiBody({ description: 'Ops webhook data' })
  async handleCallback(@Body() body: any, @Headers() headers: any) {
    return this.opsService.handleCallback({ body, headers });
  }

  @Post('url/webhook')
  @ApiOperation({ summary: 'Handle Ops webhook callback' })
  @ApiBody({ description: 'Ops webhook data' })
  async handleUrlCallback(@Body() body: any, @Headers() headers: any) {
    return this.opsService.handleCallback({ body, headers });
  }
}
