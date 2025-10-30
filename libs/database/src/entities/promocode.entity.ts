import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
  Unique,
  Enum,
  Collection,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { PromocodeUsage } from './promocode-usage.entity';


export enum PromocodeType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SPINS = 'free_spins',
}

export enum PromocodeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  USED = 'used',
}

@Entity({ tableName: 'promocodes' })
export class Promocode extends BaseEntity {
  @Property({ length: 50 })
  @Unique()
  code!: string;

  @Property({ length: 100, nullable: true })
  name?: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Enum(() => PromocodeType)
  type!: PromocodeType;

  @Property({ columnType: 'double precision' })
  amount!: number;

  @Enum(() => PromocodeStatus)
  @Property({ default: PromocodeStatus.ACTIVE })
  status: PromocodeStatus = PromocodeStatus.ACTIVE;

  @Property({ columnType: 'timestamptz', nullable: true })
  validFrom?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  validUntil?: Date;

  @Property({ default: 1 })
  maxUses: number = 1; // 0 means unlimited

  // @Property({ default: 0 })
  // currentUses: number = 0;

  // @Property({ default: 1 })
  // maxUsesPerUser: number = 1; // How many times a single user can use this code

  @Property({ columnType: 'double precision', nullable: true })
  minDepositAmount?: number; // Minimum deposit required to use this code

  @ManyToOne(() => User)
  createdBy!: User; // The admin who created this promocode

  @OneToMany(() => PromocodeUsage, (usage) => usage.promocode)
  usages = new Collection<PromocodeUsage>(this);

  @Property({ columnType: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
