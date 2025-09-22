import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Game } from './games.entity';
// if you have User/Balance entities, swap integer FKs to @ManyToOne

@Entity({ tableName: 'gameSessions' })
export class GameSession extends BaseEntity {
    @Property()
    userId!: number; // replace with @ManyToOne(() => User) if you have a User entity

    @Property({ columnType: 'text', nullable: true })
    launchURL?: string;

    @Property({ default: true })
    isAlive: boolean = true;

    @Property({ columnType: 'timestamptz', defaultRaw: 'NOW()' })
    startedAt!: Date;

    @Property({ columnType: 'timestamptz', nullable: true })
    endedAt?: Date;

    @ManyToOne(() => Game)
    game!: Game;

    @Property()
    balanceId!: number; // replace with @ManyToOne(() => Balance) if exists

    @Property({ columnType: 'double precision' })
    startAmount!: number;

    @Property({ columnType: 'double precision', nullable: true })
    endAmount?: number;

    @Property({ columnType: 'numeric(10,2)', default: 1 })
    denomination: string = '1'; // numeric best stored as string

    @Property({ columnType: 'json', nullable: true })
    metadata?: unknown;

    @Property({ columnType: 'double precision', default: 0 })
    fee: number = 0;

    @Property({ columnType: 'double precision', default: 0 })
    diff: number = 0;

    @Property({ length: 250 })
    uuid!: string;

    @Property({ default: false })
    isLive: boolean = false;

    @Property({ default: false })
    isFreeSpin: boolean = false;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
