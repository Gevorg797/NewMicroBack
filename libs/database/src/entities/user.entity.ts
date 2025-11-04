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
import { GameSession } from './game-sassion.entity';
import { PaymentPayoutRequisite } from './payment-payout_requisite.entity';
import { Bonuses } from './bonuses.entity';
import { Promocode } from './promocode.entity';
import { PromocodeUsage } from './promocode-usage.entity';

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

  @OneToMany(() => GameSession, (gs) => gs.user)
  gameSessions = new Collection<GameSession>(this);

  @OneToMany(() => Balances, (b) => b.user)
  balances = new Collection<Balances>(this);

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @OneToMany(() => FinanceTransactions, (t) => t.user)
  financeTransactions = new Collection<FinanceTransactions>(this);

  @OneToOne(() => PaymentPayoutRequisite, (ppr) => ppr.user, { nullable: true })
  paymentPayoutRequisite?: PaymentPayoutRequisite;

  @OneToMany(() => Bonuses, (b) => b.user)
  bonuses = new Collection<Bonuses>(this);

  @OneToMany(() => Promocode, (p) => p.createdBy)
  createdPromocodes = new Collection<Promocode>(this);

  @OneToMany(() => PromocodeUsage, (pu) => pu.user)
  promocodeUsages = new Collection<PromocodeUsage>(this);

  @Property({ columnType: 'date', nullable: true })
  wheelUnlockExpiresAt?: Date; // Special wheel access expiry date
}
