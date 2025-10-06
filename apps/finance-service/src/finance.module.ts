import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { FreekassaModule } from './freekassa/freekassa.module';
import { CryptobotModule } from './cryptobot/cryptobot.module';
import { YoomoneyModule } from './yoomoney/yoomoney.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, FreekassaModule, CryptobotModule, YoomoneyModule, HealthModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class FinanceModule { }
