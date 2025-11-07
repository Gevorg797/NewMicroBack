import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { HealthModule } from './health/health.module';
import { BotModule } from './bot/bot.module';

@Module({
    providers: [],
    controllers: [],
    exports: [],
    imports: [DatabaseModule, HealthModule, BotModule],
})
export class PaymentBotModule { }

