import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum BonusStatus {
  CREATED = 'Created',
  ISACTIVE = 'isActive',
  FINISHED = 'finished',
}

@Entity({ tableName: 'bonuses' })
export class Bonuses extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ columnType: 'numeric(10,2)' })
  amount!: string;

  @Enum(() => BonusStatus)
  status!: BonusStatus;
}
