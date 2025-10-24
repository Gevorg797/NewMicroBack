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
}

@Entity({ tableName: 'bonuses' })
export class Bonuses extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ columnType: 'numeric(10,2)' })
  amount!: string;

  @Enum(() => BonusStatus)
  status!: BonusStatus;

  @Enum(() => BonusType)
  type!: BonusType;

  @Property({ columnType: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  usedAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  activatedAt?: Date;

  @Property({ nullable: true })
  description?: string;
}
