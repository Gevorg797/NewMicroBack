import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { BikBetModule } from './bots/bik-bet/bikbet.module';
import { PaymentModule } from './client/payment/payment.module';
import { HealthModule } from './health/health.module';

@Module({
  providers: [],
  controllers: [],
  exports: [],
  imports: [DatabaseModule, BikBetModule, HealthModule, PaymentModule],
})
export class ApiModule { }
