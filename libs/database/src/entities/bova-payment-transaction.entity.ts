import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { BovaPaymentUser } from './bova-payment-user.entity';

export enum BovaPaymentStatus {
  WAITING = 'waiting',
  APPROVE = 'approve',
  DECLINE = 'decline',
  EXPIRED = 'expired',
  SUCCESS = 'success',
}

export enum BovaPaymentMethod {
  YOOMONEY = 'yoomoney',
  APAYS = 'apays',
}

@Entity({ tableName: 'bova_payment_transaction' })
export class BovaPaymentTransaction {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => BovaPaymentUser)
  user!: BovaPaymentUser;

  @Property()
  invoiceId!: string;

  @Property({ type: 'float' })
  amount!: number;

  @Property({ columnType: 'varchar' })
  status: BovaPaymentStatus = BovaPaymentStatus.WAITING;

  @Property({ columnType: 'varchar' })
  method!: BovaPaymentMethod;

  @Property({ type: 'float', nullable: true })
  balanceBefore?: number;

  @Property({ type: 'float', nullable: true })
  balanceAfter?: number;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    type: 'timestamptz',
    nullable: true,
    onUpdate: () => new Date(),
  })
  updatedAt?: Date;
}
