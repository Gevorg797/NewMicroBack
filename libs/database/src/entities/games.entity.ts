import { Entity, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameSubProvider } from './game-sub-providers.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { GameCategory } from './game-category.entity';

@Entity({ tableName: 'games' })
export class Game extends BaseEntity {
    @Property({ length: 100 })
    name!: string;

    @Property({ length: 256 })
    uuid!: string; // add unique: true if it must be unique

    @Property({ length: 100 })
    type!: string;

    @Property({ length: 100 })
    technology!: string;

    @Property({ default: false })
    isHasLobby: boolean = false;

    @Property({ default: true })
    isMobile: boolean = true;

    @Property({ default: true })
    isHasFreeSpins: boolean = true;

    @Property({ default: false })
    isHasTables: boolean = false;

    @Property({ default: false })
    isFreeSpinValidUntilFullDay: boolean = false;

    @ManyToOne(() => GameSubProvider)
    subProvider!: GameSubProvider;

    @OneToMany(() => GameFreeSpin, fs => fs.game)
    freeSpins = new Collection<GameFreeSpin>(this);

    @OneToMany(() => GameCategory, gc => gc.game)
    gameCategories = new Collection<GameCategory>(this);

    @Property({ default: true })
    isDesktop: boolean = true;

    @Property({ columnType: 'json', nullable: true })
    metadata?: unknown;

    @Property({ columnType: 'text', nullable: true })
    description?: string;

    @Property({ length: 250, nullable: true })
    image?: string;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
