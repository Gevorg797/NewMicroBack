import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { MsFinanceModule } from 'libs/microservices-clients/ms-finance/ms-finance.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  FinanceTransactions,
  User,
  Balances,
  FinanceProviderSettings,
  FinanceProvider,
  FinanceProviderMethods,
  FinanceProviderSubMethods,
} from '@lib/database';

@Module({
  imports: [
    MsFinanceModule,
    MikroOrmModule.forFeature([
      FinanceTransactions,
      User,
      Balances,
      FinanceProviderSettings,
      FinanceProvider,
      FinanceProviderMethods,
      FinanceProviderSubMethods,
    ]),
  ],
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService],
})
export class FinancesModule {}
