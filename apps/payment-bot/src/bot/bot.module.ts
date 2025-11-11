import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { GptService } from './gpt.service';
import { BovaPaymentUser } from '@lib/database/entities/bova-payment-user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule.register({
      timeout: 30000,
    }),
    MikroOrmModule.forFeature([BovaPaymentUser]),
  ],
  controllers: [BotController],
  providers: [BotService, GptService],
  exports: [BotService],
})
export class BotModule {}
