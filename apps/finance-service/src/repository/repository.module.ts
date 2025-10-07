import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  FinanceTransactions,
  Balances,
  User,
  Currency,
  FinanceProviderSettings,
} from '@lib/database';
import { TransactionManagerService } from './transaction-manager.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      FinanceTransactions,
      Balances,
      User,
      Currency,
      FinanceProviderSettings,
    ]),
  ],
  providers: [TransactionManagerService],
  exports: [TransactionManagerService],
})
export class RepositoryModule {}
