import {
  Entity,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Game } from './games.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { User } from './user.entity';
import { GameTransaction } from './game-transaction.entity';

@Entity({ tableName: 'gameSessions' })
export class GameSession extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

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

  @OneToMany(() => GameFreeSpin, (fs) => fs.gameSession)
  freeSpins = new Collection<GameFreeSpin>(this);

  @OneToMany(() => GameTransaction, (gt) => gt.session)
  transactions = new Collection<GameTransaction>(this);

  @Property()
  balanceId!: number; // replace with @ManyToOne(() => Balance) if exists

  @Property({ columnType: 'double precision' })
  startAmount!: number;

  @Property({ columnType: 'double precision', nullable: true })
  endAmount?: number;

  @Property({ columnType: 'numeric(10,2)', default: '1.00' })
  denomination: string = '1.00'; // supports values like 0.1, 0.2, 1.00, etc.

  @Property({ columnType: 'jsonb', nullable: true })
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
