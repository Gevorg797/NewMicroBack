import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { FreekassaModule } from './freekassa/freekassa.module';
import { CryptobotModule } from './cryptobot/cryptobot.module';

@Module({
  imports: [DatabaseModule, FreekassaModule, CryptobotModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class FinanceModule { }
