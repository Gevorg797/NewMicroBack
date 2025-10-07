import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FinanceService } from './finance.service';
import { CreatePayinDto, CreatePayoutDto } from './dto/create-payment.dto';

@Controller()
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(private readonly financeService: FinanceService) {}

  /**
   * Handle payin (deposit) request
   */
  @MessagePattern('finance.payin.create')
  async createPayin(@Payload() data: CreatePayinDto) {
    try {
      const result = await this.financeService.processPayin(data);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Payin failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle payout (withdrawal) request
   */
  @MessagePattern('finance.payout.create')
  async createPayout(@Payload() data: CreatePayoutDto) {
    try {
      const result = await this.financeService.processPayout(data);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Payout failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
