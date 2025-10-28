import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { GamesModule } from './games/games.module';
import { FinancesModule } from './finances/finances.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, GamesModule, FinancesModule, HealthModule],
})
export class AdminModule { }
