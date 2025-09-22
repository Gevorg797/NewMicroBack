// libs/database/src/entities/currency.entity.ts
import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';

@Entity({ tableName: 'currencies' })
export class Currency extends BaseEntity {
    @Property({ length: 100 })
    name!: string;

    @Property({ length: 100 })
    code!: string; // add { unique: true } if your DB enforces uniqueness

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @OneToMany(() => GamesProviderSettingGroup, group => group.currency)
    groups = new Collection<GamesProviderSettingGroup>(this);
}
