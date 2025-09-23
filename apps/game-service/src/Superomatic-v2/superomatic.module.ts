import { Module } from '@nestjs/common';
import { SuperomaticController } from './superomatic.controller';
import { SuperomaticService } from './superomatic.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProviderSettingsService } from './provider-settings.service';
import { GameProviderSetting } from '@lib/database';
import { SuperomaticApiService } from './superomatic.api.service';
import { SuperomaticUtilsService } from './superomatic.utils.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MikroOrmModule.forFeature([GameProviderSetting]),
    ],
    controllers: [SuperomaticController],
    providers: [SuperomaticService, ProviderSettingsService, SuperomaticApiService, SuperomaticUtilsService],
    exports: [SuperomaticService],
})
export class SuperomaticModule { }