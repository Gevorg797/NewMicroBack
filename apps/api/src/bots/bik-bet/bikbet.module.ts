import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BikBetController } from './bikbet.controller';
import { BikBetService } from './bikbet.service';
import { User } from '@lib/database/entities/user.entity';
import { Currency } from '@lib/database/entities/currency.entity';
import { Balances } from '@lib/database/entities/balances.entity';
import { Site } from '@lib/database/entities/site.entity';
import {
  Game,
  GameProvider,
  GameProviderSetting,
  GamesProviderSettingGroup,
  GameSubProvider,
  PaymentPayoutRequisite,
  Bonuses,
  BalancesHistory,
  FinanceTransactions,
  Promocode,
} from '@lib/database';
import { PaymentModule } from '../../client/payment/payment.module';
import { StatsModule } from '../../stats/stats.module';
import { PromocodesModule } from '../../promocodes/promocodes.module';
import { WheelModule } from '../../wheel/wheel.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forFeature([
      User,
      Currency,
      Balances,
      Site,
      GameProvider,
      GameSubProvider,
      GameProviderSetting,
      GamesProviderSettingGroup,
      Game,
      PaymentPayoutRequisite,
      Bonuses,
      BalancesHistory,
      FinanceTransactions,
      Promocode,
    ]),
    PaymentModule,
    StatsModule,
    PromocodesModule,
    WheelModule,
  ],
  controllers: [BikBetController],
  providers: [BikBetService],
  exports: [BikBetService],
})
export class BikBetModule {}
