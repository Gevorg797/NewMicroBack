import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'bova_payment_user' })
export class BovaPaymentUser {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  telegramId!: string;

  @Property({ nullable: true })
  username?: string;

  @Property({ nullable: true })
  firstName?: string;

  @Property({ nullable: true })
  lastName?: string;

  @Property({ type: 'float', default: 100 })
  balance: number = 100;

  @Property({ default: false })
  promoActivated = false;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true, onUpdate: () => new Date() })
  updatedAt?: Date;
}
