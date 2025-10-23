import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Balances } from './balances.entity';

@Entity({ tableName: 'balances_history' })
export class BalancesHistory extends BaseEntity {
  @ManyToOne(() => Balances)
  balance!: Balances;

  @Property({ columnType: 'numeric(10,2)' })
  balanceBefore!: string;

  @Property({ columnType: 'numeric(10,2)' })
  amount!: string;

  @Property({ columnType: 'numeric(10,2)' })
  balanceAfter!: string;

  @Property({ nullable: true })
  description?: string;
}
