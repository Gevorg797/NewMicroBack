import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { FreekassaModule } from './freekassa/freekassa.module';
import { CryptobotModule } from './cryptobot/cryptobot.module';
import { YoomoneyModule } from './yoomoney/yoomoney.module';
import { PlategaModule } from './platega/platega.module';
import { OpsModule } from './ops/ops.module';
import { HealthModule } from './health/health.module';
import { RepositoryModule } from './repository/repository.module';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PaymentProviderFactory } from './strategies/payment-provider.factory';
import { FinanceTransactions, FinanceProviderSubMethods } from '@lib/database';

@Module({
  imports: [
    DatabaseModule,
    RepositoryModule,
    MikroOrmModule.forFeature([FinanceTransactions, FinanceProviderSubMethods]),
    FreekassaModule,
    CryptobotModule,
    YoomoneyModule,
    PlategaModule,
    OpsModule,
    HealthModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, PaymentProviderFactory],
  exports: [FinanceService, PaymentProviderFactory],
})
export class FinanceModule {}
