import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { FreekassaService } from './freekassa.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePayinOrderDto } from './dto/create-payin-order.dto';
import { FINANCE_PATTERNS } from 'libs/config';

@ApiTags('freekassa')
@Controller('freekassa')
export class FreekassaController {
  constructor(private readonly freekassaService: FreekassaService) {}

  @MessagePattern(FINANCE_PATTERNS.FREEKASSA_CREATE_PAYIN)
  async createPayin(@Payload() payload: CreatePayinOrderDto) {
    return this.freekassaService.createPayinOrder(payload);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle Freekassa payment callback' })
  @ApiBody({ description: 'Freekassa callback data' })
  async handleCallback(@Body() body: any, @Req() req: Request) {
    const ip =
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string);

    return this.freekassaService.handleCallback({
      body,
      params: { ipAddress: ip },
    });
  }
}
