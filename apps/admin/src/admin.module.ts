import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { GamesModule } from './games/games.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, GamesModule, HealthModule],
})
export class AdminModule { }
