import {
  Collection,
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/core';
import { FinanceProviderSettings } from './finance-provider-settings.entity';
import { BaseEntity } from './base.entity';
import { FinanceTransactions } from './finance-provider-transactions.entity';
import { FinanceProviderMethods } from './finance-provider-methods.entity';
import { Site } from './site.entity';

export enum MethodTypeEnum {
  PAYIN = 'Payin',
  PAYOUT = 'Payout',
}

@Entity({ tableName: 'financeProviderSubMethods' })
export class FinanceProviderSubMethods extends BaseEntity {
  @Enum(() => MethodTypeEnum)
  type!: MethodTypeEnum;

  @Property({ default: 0, nullable: true })
  minAmount: number;

  @Property({ default: 0, nullable: true })
  maxAmount: number;

  @Property({ default: true })
  isEnabled!: boolean;

  @ManyToOne(() => FinanceProviderMethods)
  method: FinanceProviderMethods;

  @ManyToOne(() => Site)
  site!: Site;

  @OneToMany(() => FinanceTransactions, (t) => t.subMethod)
  transactions = new Collection<FinanceTransactions>(this);
}
