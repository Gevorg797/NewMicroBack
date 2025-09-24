import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BikBetController } from './bikbet.controller';
import { BikBetService } from './bikbet.service';
import { User } from '@lib/database/entities/user.entity';
import {
  Game,
  GameProvider,
  GameProviderSetting,
  GamesProviderSettingGroup,
  GameSubProvider,
} from '@lib/database';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forFeature([
      User,
      GameProvider,
      GameSubProvider,
      GameProviderSetting,
      GamesProviderSettingGroup,
      Game,
    ]),
  ],
  controllers: [BikBetController],
  providers: [BikBetService],
  exports: [BikBetService],
})
export class BikBetModule {}
