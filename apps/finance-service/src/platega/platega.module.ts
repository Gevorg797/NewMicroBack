import { Module } from '@nestjs/common';
import { PlategaController } from './platega.controller';
import { PlategaService } from './platega.service';
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
  exports: [PlategaService],
  providers: [PlategaService],
  controllers: [PlategaController],
})
export class PlategaModule {}
