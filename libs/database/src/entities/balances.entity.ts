import { Entity, Property, ManyToOne, OneToOne, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Currency } from './currency.entity';
import { GameSession } from './game-sassion.entity';

export enum BalanceType {
  MAIN = 'main',
  BONUS = 'bonus',
}

@Entity({ tableName: 'balances' })
export class Balances extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Currency)
  currency!: Currency;

  @Property({ type: 'float', default: 0 })
  balance: number = 0;

  @Enum(() => BalanceType)
  type: BalanceType = BalanceType.MAIN;

  @OneToMany(() => GameSession, (session) => session.balance)
  gameSessions = new Collection<GameSession>(this);
}
