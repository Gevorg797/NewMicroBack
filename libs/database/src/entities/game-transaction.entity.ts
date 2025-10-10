// libs/database/src/entities/game-transaction.entity.ts
import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { GameSession } from './game-sassion.entity';
import { BaseEntity } from './base.entity';

export enum GameTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

@Entity({ tableName: 'gameTransactions' })
export class GameTransaction extends BaseEntity {
  @ManyToOne(() => GameSession)
  session!: GameSession;

  @Enum(() => GameTransactionType)
  type!: GameTransactionType;

  // Assuming `user_balance` is a custom PostgreSQL domain/type based on numeric/decimal
  @Property({ columnType: 'numeric' })
  amount!: number; // MikroORM maps `numeric` best as string

  @Property({ columnType: 'jsonb', nullable: true })
  metadata?: unknown;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
