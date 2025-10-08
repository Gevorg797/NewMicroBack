import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePayinProcessDto } from './dto/create-payin-process.dto';
import { CreatePayoutProcessDto } from './dto/create-payout-process.dto';

@ApiTags('Payment Management')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payin')
  @ApiOperation({ summary: 'Create payin (deposit) order' })
  @ApiResponse({
    status: 200,
    description: 'Payin order created successfully',
    schema: {
      example: {
        paymentUrl: 'https://payment-provider.com/pay?...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async payin(@Body() body: CreatePayinProcessDto) {
    return this.paymentService.payin(body);
  }

  @Post('payout')
  @ApiOperation({ summary: 'Create payout (withdrawal) order' })
  @ApiResponse({
    status: 200,
    description: 'Payout order created successfully',
    schema: {
      example: {
        success: true,
        transactionId: 123,
        status: 'pending',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - insufficient balance',
  })
  @ApiResponse({ status: 404, description: 'User or method not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async payout(@Body() body: CreatePayoutProcessDto) {
    return this.paymentService.payout(body);
  }
}
