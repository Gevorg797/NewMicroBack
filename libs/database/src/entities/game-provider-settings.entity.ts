import { Entity, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameProvider } from './game-providers.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';

@Entity({ tableName: 'gameProviderSettings' })
export class GameProviderSetting extends BaseEntity {
    // If you have a Site entity, switch to ManyToOne(() => Site)
    @ManyToOne(() => GameProvider)
    provider!: GameProvider;

    @Property({ length: 100, nullable: true })
    token?: string;

    @Property({ length: 100, nullable: true })
    key?: string;

    @Property({ length: 200, nullable: true })
    baseURL?: string;

    @Property({ columnType: 'jsonb', nullable: true })
    metadata?: unknown;

    @Property({ length: 200, nullable: true })
    name?: string;

    @Property({ default: false })
    isDefault: boolean = false;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @OneToMany(() => GamesProviderSettingGroup, g => g.setting)
    groups = new Collection<GamesProviderSettingGroup>(this);
}
