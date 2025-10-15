import { Injectable } from '@nestjs/common';
import { EntityManager, EntityName, FilterQuery } from '@mikro-orm/core';
import { BaseEntity } from '@lib/database/entities/base.entity';
import { paginate, PaginateQuery, PaginateResult } from '../pagination';

export interface CrudServiceConfig<_Entity = any> {
    /**
     * Relations to populate when fetching entities
     */
    relations?: string[];

    /**
     * Fields to search when using pagination search
     */
    searchableFields?: string[];

    /**
     * Whether to use soft delete (requires deletedAt field on entity)
     */
    useSoftDelete?: boolean;
}

@Injectable()
export abstract class AbstractCrudService<Entity extends BaseEntity> {
    protected abstract readonly entityClass: EntityName<Entity>;
    protected abstract readonly em: EntityManager;
    protected config: CrudServiceConfig<Entity> = {
        relations: [],
        searchableFields: [],
        useSoftDelete: false,
    };

    /**
     * Create a new entity
     * @param createDto - Data transfer object with entity data
     * @returns Created entity
     */
    async create<CreateDto>(createDto: CreateDto): Promise<Entity> {
        const entity = this.em.create(this.entityClass, createDto as any);
        await this.em.persistAndFlush(entity);
        return entity;
    }

    /**
     * Find an entity by ID
     * @param id - Entity ID
     * @param relations - Optional relations to populate (overrides config)
     * @returns Entity or null if not found
     */
    async findById(
        id: number,
        relations?: string[],
    ): Promise<Entity | null> {
        const populateRelations = relations || this.config.relations || [];

        const whereConditions: FilterQuery<Entity> = { id } as FilterQuery<Entity>;

        // Add soft delete filter if enabled
        if (this.config.useSoftDelete) {
            (whereConditions as any).deletedAt = null;
        }

        const entity = await this.em.findOne(
            this.entityClass,
            whereConditions,
            {
                populate: populateRelations as any,
            },
        );

        return entity;
    }

    /**
     * Find a single entity by custom filter
     * @param where - Filter conditions
     * @param relations - Optional relations to populate
     * @returns Entity or null if not found
     */
    async findOne(
        where: FilterQuery<Entity>,
        relations?: string[],
    ): Promise<Entity | null> {
        const populateRelations = relations || this.config.relations || [];

        const whereConditions = { ...(where as object) } as FilterQuery<Entity>;

        // Add soft delete filter if enabled
        if (this.config.useSoftDelete) {
            (whereConditions as any).deletedAt = null;
        }

        const entity = await this.em.findOne(
            this.entityClass,
            whereConditions,
            {
                populate: populateRelations as any,
            },
        );

        return entity;
    }

    /**
     * Find all entities with pagination
     * @param query - Pagination query parameters
     * @param relations - Optional relations to populate (overrides config)
     * @param searchableFields - Optional searchable fields (overrides config)
     * @returns Paginated result
     */
    async findAll(
        query: PaginateQuery,
        relations?: string[],
        searchableFields?: string[],
    ): Promise<PaginateResult<Entity>> {
        const populateRelations = relations || this.config.relations || [];
        const fields = searchableFields || this.config.searchableFields || [];

        // If soft delete is enabled, add deletedAt filter
        if (this.config.useSoftDelete) {
            if (!query.filters) {
                query.filters = {};
            }
            // Only show non-deleted entities
            if (!query.filters.deletedAt) {
                query.filters.deletedAt = null;
            }
        }

        return paginate(
            this.em,
            this.entityClass,
            query,
            populateRelations,
            fields,
        );
    }

    /**
     * Update an entity by ID
     * @param id - Entity ID
     * @param updateDto - Data transfer object with updated data
     * @returns Updated entity
     */
    async update<UpdateDto>(
        id: number,
        updateDto: UpdateDto,
    ): Promise<Entity> {
        const entity = await this.findById(id);

        if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
        }

        this.em.assign(entity, updateDto as any);
        await this.em.flush();

        return entity;
    }

    /**
     * Delete an entity by ID
     * @param id - Entity ID
     * @returns Deleted entity (or soft deleted entity)
     */
    async delete(id: number): Promise<Entity> {
        const entity = await this.findById(id);

        if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
        }

        if (this.config.useSoftDelete) {
            // Soft delete
            (entity as any).deletedAt = new Date();
            await this.em.flush();
        } else {
            // Hard delete
            await this.em.removeAndFlush(entity);
        }

        return entity;
    }

    /**
     * Restore a soft-deleted entity by ID
     * @param id - Entity ID
     * @returns Restored entity
     */
    async restore(id: number): Promise<Entity> {
        if (!this.config.useSoftDelete) {
            throw new Error('Restore is only available when soft delete is enabled');
        }

        const entity = await this.em.findOne(
            this.entityClass,
            { id } as FilterQuery<Entity>,
            {
                populate: this.config.relations as any,
            },
        );

        if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
        }

        (entity as any).deletedAt = null;
        await this.em.flush();

        return entity;
    }

    /**
     * Count entities based on filter
     * @param where - Optional filter conditions
     * @returns Count of entities
     */
    async count(where?: FilterQuery<Entity>): Promise<number> {
        const whereConditions = { ...(where as object || {}) } as FilterQuery<Entity>;

        // Add soft delete filter if enabled
        if (this.config.useSoftDelete) {
            (whereConditions as any).deletedAt = null;
        }

        return this.em.count(this.entityClass, whereConditions);
    }

    /**
     * Check if entity exists by ID
     * @param id - Entity ID
     * @returns True if exists, false otherwise
     */
    async exists(id: number): Promise<boolean> {
        const count = await this.count({ id } as FilterQuery<Entity>);
        return count > 0;
    }
}

