// libs/database/src/entities/game-transaction.entity.ts
import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { GameSession } from './game-sassion.entity';
import { BaseEntity } from './base.entity';

@Entity({ tableName: 'gameTransactions' })
export class GameTransaction extends BaseEntity {
  @ManyToOne(() => GameSession)
  session!: GameSession;

  @Property({ length: 70 })
  type!: string;

  // Assuming `user_balance` is a custom PostgreSQL domain/type based on numeric/decimal
  @Property({ columnType: 'numeric' })
  amount!: number; // MikroORM maps `numeric` best as string

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
