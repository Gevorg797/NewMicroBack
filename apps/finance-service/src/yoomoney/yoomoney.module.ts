import { Module } from '@nestjs/common';
import { YoomoneyController } from './yoomoney.controller';
import { YoomoneyServcie } from './yoomoney.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forFeature([
      FinanceProviderSettings,
      Currency,
      FinanceTransactions,
    ]),
    RepositoryModule,
  ],
  exports: [YoomoneyServcie],
  providers: [YoomoneyServcie],
  controllers: [YoomoneyController],
})
export class YoomoneyModule {}
