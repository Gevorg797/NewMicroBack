import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Game } from './games.entity';
import { GameSession } from './game-sassion.entity';

@Entity({ tableName: 'gameFreeSpins' })
export class GameFreeSpin extends BaseEntity {
    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Game)
    game!: Game;

    @Property({ default: 1 })
    betCount: number = 1;

    @Property({ default: 2 })
    weidger: number = 2; // typo in DB? maybe meant "wager"

    @Property({ columnType: 'timestamptz', nullable: true })
    activeUntil?: Date;

    @Property({ columnType: 'numeric(10,2)', default: '1' })
    denomination: string = '1';

    @Property({ default: false })
    isActivated: boolean = false;

    @Property({ columnType: 'timestamptz', nullable: true })
    activatedAt?: Date;

    @Property({ columnType: 'timestamptz', nullable: true })
    isActiveDate?: Date;

    @ManyToOne(() => GameSession, { nullable: true })
    gameSession?: GameSession;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @Property({ default: 0 })
    estimateSpins: number = 0;

    @Property({ columnType: 'numeric(10,2)', default: '0' })
    bank: string = '0';

    @Property({ default: true })
    isActive: boolean = true;
}
