import { Module } from '@nestjs/common';
import { CryptobotController } from './cryptobot.controller';
import { CryptobotService } from './cryptobot.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  Balances,
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { RepositoryModule } from '../repository/repository.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forFeature([
      FinanceProviderSettings,
      Currency,
      FinanceTransactions,
      Balances,
    ]),
    RepositoryModule,
    NotificationsModule,
  ],
  exports: [CryptobotService],
  providers: [CryptobotService],
  controllers: [CryptobotController],
})
export class CryptobotModule {}
