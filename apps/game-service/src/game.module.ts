import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { SuperomaticModule } from './Superomatic-v2/superomatic.module';
import { B2BSlotsModule } from './B2BSlots-v1/b2bslots.module';
import { HealthModule } from './health/health.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [DatabaseModule, SuperomaticModule, B2BSlotsModule, HealthModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule { }
