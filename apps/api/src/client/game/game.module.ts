import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { MsGameModule } from 'libs/microservices-clients/ms-game/ms-game.module';

@Module({
  imports: [MsGameModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}

