import { Module, forwardRef } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { MsGameModule } from 'libs/microservices-clients/ms-game/ms-game.module';

@Module({
    imports: [MsGameModule],
    controllers: [GamesController],
    providers: [GamesService],
    exports: [GamesService],
})
export class GamesModule { }
