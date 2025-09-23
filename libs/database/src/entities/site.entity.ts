import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GameProviderSetting } from './game-provider-settings.entity';

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

    @OneToMany(() => User, user => user.site)
    users = new Collection<User>(this);

    @OneToMany(() => GameProviderSetting, s => s.site)
    providerSettings = new Collection<GameProviderSetting>(this);

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
