import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [DatabaseModule, GamesModule],
})
export class AdminModule { }
