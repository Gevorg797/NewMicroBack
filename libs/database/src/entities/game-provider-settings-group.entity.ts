import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameProviderSetting } from './game-provider-settings.entity';

@Entity({ tableName: 'gamesProviderSettingGroups' })
export class GamesProviderSettingGroup extends BaseEntity {
    @Property({ length: 100 })
    name!: string;

    @ManyToOne(() => GameProviderSetting)
    setting!: GameProviderSetting;

    // If you have a Currency entity, switch to ManyToOne(() => Currency)
    @Property({ default: 1 })
    currencyId: number = 1;

    @Property({ default: false })
    isDefault: boolean = false;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
