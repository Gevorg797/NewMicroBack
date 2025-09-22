import { Entity, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';

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

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
