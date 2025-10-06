import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Currency } from './currency.entity';
import { FinanceProviderSubMethods } from './finance-provider-sub-method.entity';

export enum PaymentTransactionStatus {
  CREATED = 'Created',
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
}

export enum PaymentTransactionUserResponseStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum PaymentTransactionType {
  PAYIN = 'Payin',
  PAYOUT = 'Payout',
}

@Entity({ tableName: 'financeTransactions' })
export class FinanceTransactions extends BaseEntity {
  @Property({ columnType: 'double precision' })
  amount!: number;

  @Enum(() => PaymentTransactionType)
  type!: PaymentTransactionType;

  @Enum(() => PaymentTransactionUserResponseStatus)
  userResponseStatus: PaymentTransactionUserResponseStatus =
    PaymentTransactionUserResponseStatus.PENDING;

  @Enum(() => PaymentTransactionStatus)
  status: PaymentTransactionStatus = PaymentTransactionStatus.PENDING;

  @ManyToOne(() => FinanceProviderSubMethods)
  subMethod!: FinanceProviderSubMethods;

  @ManyToOne(() => User)
  user!: User;

  @Property({ nullable: true })
  paymentTransactionId?: string;

  @Property({ nullable: true })
  phoneNumber?: number;

  @Property({ nullable: true })
  requisite?: string;

  @Property({ nullable: true })
  uuid?: string; // Optional transaction uuid

  @Property({ nullable: true, default: null })
  redirectSuccessUrl?: string | null;

  @Property({ nullable: true, default: null })
  redirectFailedUrl?: string | null;

  @ManyToOne(() => Currency)
  currency: Currency;
}
