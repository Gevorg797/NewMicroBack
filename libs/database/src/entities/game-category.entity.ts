import { Entity, Property, ManyToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { Game } from './games.entity';

@Entity({ tableName: 'game_categories' })
export class GameCategory extends BaseEntity {
  @Property({ length: 100 })
  name!: string; // replaces categoryId with plain name

  // @ManyToMany(() => Game, (g) => g.categories, { mappedBy: 'categories' })
  // games = new Collection<Game>(this);

  @Property({ default: true })
  isGameDesktop: boolean = true;

  @Property({ default: false })
  isGameMobile: boolean = false;

  @Property({ columnType: 'double precision', nullable: true })
  order?: number;
}
