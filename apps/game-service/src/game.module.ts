import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { SuperomaticModule } from './Superomatic-v2/superomatic.module';
import { B2BSlotsModule } from './B2BSlots-v1/b2bslots.module';
import { HealthModule } from './health/health.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { ProviderStrategyFactory } from './strategies/provider-strategy.factory';
import { RepositoryModule } from './repository/repository.module';

@Module({
  imports: [DatabaseModule, RepositoryModule, SuperomaticModule, B2BSlotsModule, HealthModule],
  controllers: [GameController],
  providers: [GameService, ProviderStrategyFactory],
  exports: [GameService, ProviderStrategyFactory],
})
export class GameModule { }
