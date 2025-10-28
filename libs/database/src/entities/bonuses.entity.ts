import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum BonusStatus {
  CREATED = 'Created',
  ACTIVE = 'Active',
  USED = 'Used',
  EXPIRED = 'Expired',
}

export enum BonusType {
  FREESPIN = 'Freespin',
  WHEEL = 'Wheel',
  PROMOCODE = 'Promocode',
  PERSONAL = 'Personal',
}

@Entity({ tableName: 'bonuses' })
export class Bonuses extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ columnType: 'numeric(10,2)' })
  amount!: string;

  @Enum(() => BonusStatus)
  status!: BonusStatus;

  @Property({ type: 'text', nullable: true })
  type?: BonusType;

  @Property({ columnType: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  usedAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  activatedAt?: Date;

  @Property({ nullable: true })
  description?: string;

  // Wagering requirement: Total amount that must be wagered (usually 2x bonus amount)
  @Property({ columnType: 'numeric(10,2)', nullable: true, default: '0' })
  wageringRequired?: string;
}
