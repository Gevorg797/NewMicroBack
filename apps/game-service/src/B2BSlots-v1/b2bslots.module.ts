import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GameProviderSetting, Game, GameProvider, GameSubProvider } from '@lib/database';
import { B2BSlotsService } from './b2bslots.service';
import { B2BSlotsApiService } from './b2bslots.api.service';
import { B2BSlotsUtilsService } from './b2bslots.utils.service';
import { B2BSlotsProviderSettingsService } from './provider-settings.service';
import { B2BSlotsWebhookController } from './b2bslots.webhook.controller';
import { B2BSlotsWebhookService } from './b2bslots.webhook.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forFeature([GameProviderSetting, Game, GameProvider, GameSubProvider]),
  ],
  controllers: [B2BSlotsWebhookController],
  providers: [
    B2BSlotsService,
    B2BSlotsApiService,
    B2BSlotsUtilsService,
    B2BSlotsProviderSettingsService,
    B2BSlotsWebhookService,
  ],
  exports: [B2BSlotsService],
})
export class B2BSlotsModule { }
