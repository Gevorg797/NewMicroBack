// libs/database/src/entities/games_provider_setting_groups.entity.ts
import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameProviderSetting } from './game-provider-settings.entity'; // keep your actual filename
import { Currency } from './currency.entity';

@Entity({ tableName: 'gamesProviderSettingGroups' })
export class GamesProviderSettingGroup extends BaseEntity {
  @Property({ length: 100 })
  name!: string;

  @ManyToOne(() => GameProviderSetting)
  setting!: GameProviderSetting;

  // FK column name will be currency_id by default; force exact name if you need:
  @ManyToOne(() => Currency)
  currency!: Currency; // DB default(1) can remain in schema/migration

  @Property({ default: false })
  isDefault: boolean = false;

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
