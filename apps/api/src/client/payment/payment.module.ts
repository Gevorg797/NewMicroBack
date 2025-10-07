import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { MsFinanceModule } from 'libs/microservices-clients/ms-finance/ms-finance.module';

@Module({
  imports: [MsFinanceModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
