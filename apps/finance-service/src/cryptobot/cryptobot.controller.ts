import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FINANCE_PATTERNS } from 'libs/config';
import { CryptobotService } from './cryptobot.service';

@ApiTags('cryptobot')
@Controller('cryptobot')
export class CryptobotController {
  constructor(private readonly cryptobotService: CryptobotService) {}

  @MessagePattern(FINANCE_PATTERNS.CRYPTOBOT_CREATE_PAYIN)
  async createPayin(@Payload() payload: any) {
    return this.cryptobotService.createPayinOrder(payload);
  }

  @MessagePattern(FINANCE_PATTERNS.CRYPTOBOT_CREATE_PAYOUT)
  async createPayout(@Payload() payload: any) {
    return this.cryptobotService.createPayoutProcess(payload);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Cryptobot webhook callback' })
  @ApiBody({ description: 'Cryptobot webhook data' })
  async handleCallback(@Body() body: any, @Headers() headers: any) {
    return this.cryptobotService.handleCallback({ body, headers });
  }
}
