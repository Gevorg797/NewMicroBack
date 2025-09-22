import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GameProvider } from './game-providers.entity';

@Entity({ tableName: 'gameSubProviders' })
export class GameSubProvider extends BaseEntity {
    @Property({ length: 100 })
    name!: string;

    @ManyToOne(() => GameProvider)
    provider!: GameProvider;

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @Property({ length: 250, nullable: true })
    image?: string;
}
