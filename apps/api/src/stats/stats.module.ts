import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { User, GameSession, GameTransaction } from '@lib/database';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            User,
            GameSession,
            GameTransaction,
        ]),
    ],
    providers: [StatsService],
    exports: [StatsService],
})
export class StatsModule { }
