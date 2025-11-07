import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
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
    ]),
    RepositoryModule,
    NotificationsModule,
  ],
  exports: [OpsService],
  providers: [OpsService],
  controllers: [OpsController],
})
export class OpsModule {}
