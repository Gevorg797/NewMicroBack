import { Module, forwardRef } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { MsGameModule } from 'libs/microservices-clients/ms-game/ms-game.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Game } from '@lib/database';

@Module({
    imports: [
        MsGameModule,
        MikroOrmModule.forFeature([Game])
    ],
    controllers: [GamesController],
    providers: [GamesService],
    exports: [GamesService],
})
export class GamesModule { }
