import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { User } from '@lib/database/entities/user.entity';
import { Currency } from '@lib/database/entities/currency.entity';
import { Balances } from '@lib/database/entities/balances.entity';
import { Site } from '@lib/database/entities/site.entity';
import {
    BalancesHistory,
    FinanceTransactions,
    PaymentPayoutRequisite,
} from '@lib/database';

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
            PaymentPayoutRequisite,
            BalancesHistory,
            FinanceTransactions,
        ]),
    ],
    controllers: [BotController],
    providers: [BotService],
    exports: [BotService],
})
export class BotModule { }

