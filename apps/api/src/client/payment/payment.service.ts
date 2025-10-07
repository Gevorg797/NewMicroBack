import { Injectable, Logger } from '@nestjs/common';
import { CreatePayinProcessDto } from './dto/create-payin-process.dto';
import { CreatePayoutProcessDto } from './dto/create-payout-process.dto';
import { MsFinanceService } from 'libs/microservices-clients/ms-finance/ms-finance.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly msFinanceService: MsFinanceService) {}

  async payin(body: CreatePayinProcessDto) {
    try {
      const result = await this.msFinanceService.createPayin({
        userId: body.userId,
        amount: body.amount,
        methodId: body.methodId,
        uuId: body.uuId,
      });

      this.logger.log(`Payin request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Payin request failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async payout(body: CreatePayoutProcessDto) {
    try {
      const result = await this.msFinanceService.createPayout({
        userId: body.userId,
        amount: body.amount,
        methodId: body.methodId,
        requisite: body.requisite,
      });

      this.logger.log(`Payout request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Payout request failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
