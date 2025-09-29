import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Site } from './site.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { Balances } from './balances.entity';
import { FinanceTransactions } from './finance-provider-transactions.entity';

@Entity()
export class User extends BaseEntity {
  @Property({ nullable: false })
  @Unique()
  telegramId: string;

  @Property({ nullable: true })
  @Unique()
  name: string;

  @Property({ nullable: true })
  @Unique()
  email?: string;

  @ManyToOne(() => Site)
  site!: Site;

  @OneToMany(() => GameFreeSpin, (fs) => fs.user)
  freeSpins = new Collection<GameFreeSpin>(this);

  @OneToOne(() => Balances, (b) => b.user)
  balance?: Balances;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @OneToMany(() => FinanceTransactions, t => t.user)
  financeTransactions = new Collection<FinanceTransactions>(this);
}
