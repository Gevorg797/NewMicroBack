import { Module } from '@nestjs/common';
import { FreekassaController } from './freekassa.controller';
import { FreekassaService } from './freekassa.service';
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
  controllers: [FreekassaController],
  providers: [FreekassaService],
  exports: [FreekassaService],
})
export class FreekassaModule {}
