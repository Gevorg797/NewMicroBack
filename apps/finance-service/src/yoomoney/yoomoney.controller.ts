import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { YoomoneyServcie } from './yoomoney.service';
import { YooMoneyCallbackDto } from './dto/handle-callback.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FINANCE_PATTERNS } from 'libs/config';

@ApiTags('yoomoney')
@Controller('yoomoney')
export class YoomoneyController {
  constructor(private readonly yoomoneyService: YoomoneyServcie) {}

  @MessagePattern(FINANCE_PATTERNS.YOOMONEY_CREATE_PAYIN)
  async createPayin(@Payload() payload: any) {
    return this.yoomoneyService.createPayinOrder(payload);
  }

  @MessagePattern(FINANCE_PATTERNS.YOOMONEY_CREATE_PAYOUT)
  async createPayout(@Payload() payload: any) {
    return this.yoomoneyService.createPayoutProcess(payload);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle YooMoney payment callback' })
  @ApiBody({ type: YooMoneyCallbackDto })
  async handleCallback(@Body() body: YooMoneyCallbackDto) {
    await this.yoomoneyService.handleCallback({ body });
    return { ok: true };
  }
}
