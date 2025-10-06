import { Module } from '@nestjs/common';
import { SuperomaticService } from './superomatic.service';
import { PartnerWebhooksController } from './partner-webhooks.controller';
import { PartnerWebhooksService } from './partner-webhooks.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProviderSettingsService } from './provider-settings.service';
import { GameProviderSetting, Game, GameSubProvider, GameProvider, User } from '@lib/database';
import { SuperomaticApiService } from './superomatic.api.service';
import { SuperomaticUtilsService } from './superomatic.utils.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MikroOrmModule.forFeature([GameProviderSetting, Game, GameSubProvider, GameProvider, User]),
    ],
    controllers: [PartnerWebhooksController],
    providers: [
        SuperomaticService,
        PartnerWebhooksService,
        ProviderSettingsService,
        SuperomaticApiService,
        SuperomaticUtilsService,
    ],
    exports: [SuperomaticService, PartnerWebhooksService],
})
export class SuperomaticModule { }
