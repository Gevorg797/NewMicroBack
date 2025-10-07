import { Module } from '@nestjs/common';
import { CryptobotController } from './cryptobot.controller';
import { CryptobotService } from './cryptobot.service';
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
  exports: [CryptobotService],
  providers: [CryptobotService],
  controllers: [CryptobotController],
})
export class CryptobotModule {}
