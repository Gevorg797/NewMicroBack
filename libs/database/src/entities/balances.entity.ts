import { Entity, Property, ManyToOne, OneToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Currency } from './currency.entity';

@Entity({ tableName: 'balances' })
export class Balances extends BaseEntity {
  @OneToOne(() => User, { owner: true, unique: true })
  user!: User;

  @ManyToOne(() => Currency)
  currency!: Currency;

  @Property({ type: 'float', default: 0 })
  balance: number = 0;

  @Property({ type: 'float', default: 0 })
  bonusBalance: number = 0;
}
