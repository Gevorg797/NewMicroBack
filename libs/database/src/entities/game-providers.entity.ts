import { Entity, Property, OneToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameSubProvider } from './game-sub-providers.entity';
import { GameProviderSetting } from './game-provider-settings.entity';

@Entity({ tableName: 'gameProviders' })
export class GameProvider extends BaseEntity {
    @Property({ length: 250 })
    name!: string;

    @Property({ columnType: 'double precision', default: 0 })
    feePercent: number = 0;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @OneToMany(() => GameSubProvider, sp => sp.provider)
    subProviders = new Collection<GameSubProvider>(this);

    @OneToMany(() => GameProviderSetting, s => s.provider)
    settings = new Collection<GameProviderSetting>(this);
}
