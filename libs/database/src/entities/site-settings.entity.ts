import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Site } from './site.entity';

@Entity({ tableName: 'siteSettings' })
export class SiteSettings extends BaseEntity {
  @OneToOne(() => Site, (site) => site.settings)
  site!: Site;

  @Property({ default: false })
  canAgentWithdraw: boolean = false;

  @Property({ default: 5 })
  cashbackPercent: number = 5;

  @Property({ default: true })
  isWheelEnabled: boolean = true;

  @Property({ default: true })
  isPayoutsVisible: boolean = true;

  @Property({ default: true })
  isPayinsVisible: boolean = true;

  @Property({ default: true })
  isBonusesVisible: boolean = true;

  // @Property({ type: 'varchar', length: 100, array: true, nullable: true })
  // phoneConfirmMethod?: string[];

  @Property({ nullable: true })
  gameOfDay?: number;
}
