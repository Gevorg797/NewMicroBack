/**
 * EXAMPLE: How to use AbstractCrudService
 * 
 * This file demonstrates how to refactor an existing service to use the AbstractCrudService.
 * Copy this pattern to create your own CRUD services.
 */

import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { AbstractCrudService } from './abstract-crud.service';
import { Game } from '@lib/database';
import { PaginateQuery } from '../pagination';

/**
 * Example DTOs
 */
export class CreateGameDto {
    name: string;
    uuid: string;
    type: string;
    technology: string;
    subProviderId: number;
    isHasLobby?: boolean;
    isMobile?: boolean;
    isDesktop?: boolean;
    description?: string;
    image?: string;
}

export class UpdateGameDto {
    name?: string;
    description?: string;
    image?: string;
    isMobile?: boolean;
    isDesktop?: boolean;
}

/**
 * Example Service using AbstractCrudService
 * 
 * This replaces manual CRUD operations with inherited methods from AbstractCrudService.
 */
@Injectable()
export class ExampleGamesService extends AbstractCrudService<Game> {
    // Required: Define the entity class
    protected readonly entityClass = Game;

    constructor(
        // Required: Inject EntityManager
        protected readonly em: EntityManager,
    ) {
        super();

        // Configure the service
        this.config = {
            // Relations to populate when fetching games
            relations: ['subProvider', 'subProvider.provider', 'categories'],

            // Fields that can be searched in pagination
            searchableFields: [
                'name',
                'type',
                'subProvider.name',
                'subProvider.provider.name',
            ],

            // Enable soft delete (Game entity has deletedAt field)
            useSoftDelete: true,
        };
    }

    // ============================================
    // INHERITED METHODS (No need to implement)
    // ============================================
    // ✅ create(dto: CreateGameDto)
    // ✅ findById(id: number)
    // ✅ findAll(query: PaginateQuery)
    // ✅ update(id: number, dto: UpdateGameDto)
    // ✅ delete(id: number)
    // ✅ restore(id: number)
    // ✅ findOne(where: FilterQuery<Game>)
    // ✅ count(where?: FilterQuery<Game>)
    // ✅ exists(id: number)

    // ============================================
    // CUSTOM BUSINESS LOGIC METHODS
    // ============================================

    /**
     * Find games by type with pagination
     */
    async findGamesByType(type: string, query: PaginateQuery) {
        // Add type filter to the query
        query.filters = { ...query.filters, type };
        return this.findAll(query);
    }

    /**
     * Find mobile games
     */
    async findMobileGames(query: PaginateQuery) {
        query.filters = { ...query.filters, isMobile: true };
        return this.findAll(query);
    }

    /**
     * Find games by provider
     */
    async findGamesByProvider(providerId: number, query: PaginateQuery) {
        query.filters = { ...query.filters, 'subProvider.provider.id': providerId };
        return this.findAll(query);
    }

    /**
     * Find game by UUID (custom query)
     */
    async findByUuid(uuid: string) {
        return this.findOne({ uuid } as any);
    }

    /**
     * Count games by type
     */
    async countByType(type: string) {
        return this.count({ type } as any);
    }

    /**
     * Check if game exists by UUID
     */
    async existsByUuid(uuid: string): Promise<boolean> {
        const game = await this.findByUuid(uuid);
        return game !== null;
    }

    /**
     * Soft delete all games by provider
     */
    async deleteGamesByProvider(providerId: number) {
        const games = await this.em.find(Game, {
            subProvider: { provider: { id: providerId } },
        } as any);

        for (const game of games) {
            await this.delete(game.id!);
        }

        return { deletedCount: games.length };
    }

    /**
     * Custom method: Update game with validation
     */
    async updateGameWithValidation(id: number, dto: UpdateGameDto) {
        // Add custom validation before update
        const game = await this.findById(id);

        if (!game) {
            throw new Error(`Game with id ${id} not found`);
        }

        // Custom business logic
        if (dto.name && dto.name.length < 3) {
            throw new Error('Game name must be at least 3 characters');
        }

        // Use inherited update method
        return this.update(id, dto);
    }
}

// ============================================
// USAGE IN CONTROLLER
// ============================================

/**
 * Example Controller using the service
 */
/*
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: ExampleGamesService) {}

  @Post()
  create(@Body() createDto: CreateGameDto) {
    return this.gamesService.create(createDto);
  }

  @Get()
  findAll(@Query() query: PaginateQuery) {
    return this.gamesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.gamesService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() updateDto: UpdateGameDto) {
    return this.gamesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.gamesService.delete(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: number) {
    return this.gamesService.restore(id);
  }

  @Get('type/:type')
  findByType(@Param('type') type: string, @Query() query: PaginateQuery) {
    return this.gamesService.findGamesByType(type, query);
  }

  @Get('mobile')
  findMobile(@Query() query: PaginateQuery) {
    return this.gamesService.findMobileGames(query);
  }
}
*/

// ============================================
// MIGRATION GUIDE
// ============================================

/**
 * How to migrate existing service to AbstractCrudService:
 * 
 * BEFORE:
 * -------
 * @Injectable()
 * export class GamesService {
 *   constructor(private readonly em: EntityManager) {}
 * 
 *   async create(dto: CreateGameDto) {
 *     const game = this.em.create(Game, dto);
 *     await this.em.persistAndFlush(game);
 *     return game;
 *   }
 * 
 *   async findById(id: number) {
 *     return this.em.findOne(Game, { id }, { populate: ['subProvider'] });
 *   }
 * 
 *   async findAll(query: PaginateQuery) {
 *     return paginate(this.em, Game, query, ['subProvider'], ['name']);
 *   }
 * 
 *   async update(id: number, dto: UpdateGameDto) {
 *     const game = await this.findById(id);
 *     if (!game) throw new Error('Not found');
 *     this.em.assign(game, dto);
 *     await this.em.flush();
 *     return game;
 *   }
 * 
 *   async delete(id: number) {
 *     const game = await this.findById(id);
 *     if (!game) throw new Error('Not found');
 *     await this.em.removeAndFlush(game);
 *     return game;
 *   }
 * }
 * 
 * AFTER:
 * ------
 * @Injectable()
 * export class GamesService extends AbstractCrudService<Game> {
 *   protected readonly entityClass = Game;
 * 
 *   constructor(protected readonly em: EntityManager) {
 *     super();
 *     this.config = {
 *       relations: ['subProvider'],
 *       searchableFields: ['name'],
 *       useSoftDelete: true,
 *     };
 *   }
 * 
 *   // All CRUD methods inherited! ✅
 *   // Add only custom business logic here
 * }
 * 
 * Benefits:
 * - 50+ lines of boilerplate code removed
 * - Consistent error handling
 * - Soft delete support
 * - Additional utility methods (count, exists, findOne, restore)
 * - Less maintenance
 */

