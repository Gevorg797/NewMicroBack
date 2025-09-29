import {
  Collection,
  Entity,
  OneToMany,
  OneToOne,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GameProviderSetting } from './game-provider-settings.entity';
import { SiteSettings } from './site-settings.entity';
import { FinanceProviderSettings } from './finance-provider-settings.entity';
import { FinanceProviderSubMethods } from './finance-provider-sub-method.entity';

@Entity({ tableName: 'sites' })
export class Site extends BaseEntity {
  @Property({ length: 100 })
  name!: string;

  @Property({ length: 100 })
  title!: string;

  @Property({ length: 100 })
  url!: string;

  @Property({ columnType: 'text', nullable: true })
  disabledText?: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ length: 100, nullable: true })
  metaName?: string;

  @Property({ length: 250, nullable: true })
  metaDescription?: string;

  @OneToMany(() => User, (user) => user.site)
  users = new Collection<User>(this);

  @OneToMany(() => GameProviderSetting, (s) => s.site)
  providerSettings = new Collection<GameProviderSetting>(this);

  @OneToMany(() => FinanceProviderSettings, (s) => s.site)
  financeSettings = new Collection<FinanceProviderSettings>(this);

  @OneToMany(() => FinanceProviderSubMethods, (s) => s.site)
  subMethods = new Collection<FinanceProviderSubMethods>(this);

  @OneToOne(() => SiteSettings, { owner: true, nullable: true })
  settings?: SiteSettings;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
