import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum WheelTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Entity({ tableName: 'wheelTransactions' })
export class WheelTransaction extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ columnType: 'numeric(10,2)' })
  amount!: string;

  @Enum(() => WheelTransactionStatus)
  status: WheelTransactionStatus = WheelTransactionStatus.PENDING;

  @Property({ columnType: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Property({ columnType: 'timestamptz', nullable: true })
  wheelUnlockExpiresAt?: Date;
}
