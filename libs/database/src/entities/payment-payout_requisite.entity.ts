import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity({ tableName: 'payment_payout_requisites' })
export class PaymentPayoutRequisite extends BaseEntity {
  @OneToOne(() => User, { nullable: false, owner: true })
  user!: User;

  @Property({ nullable: true })
  freekassa_id?: string;

  @Property({ nullable: true })
  sbp?: string;

  @Property({ nullable: true })
  card?: string;
}
