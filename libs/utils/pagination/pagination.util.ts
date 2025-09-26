import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiExtraModels,
    ApiProperty,
    ApiResponse,
    getSchemaPath,
} from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { EntityManager, EntityRepository, FilterQuery, FindOptions, EntityName } from '@mikro-orm/core';
import { Allow } from 'class-validator';

// Pagination result class
export class PaginateResult<T> {
    @ApiProperty({ isArray: true })
    docs: T[];

    @ApiProperty()
    @Expose()
    totalDocs: number;

    @ApiProperty()
    @Expose()
    limit: number;

    @ApiProperty()
    @Expose()
    totalPages: number;

    @ApiProperty()
    @Expose()
    page: number;
}

// Pagination query class
export class PaginateQuery {
    @Allow()
    @Transform(({ value }) => Number(value))
    @ApiProperty({ default: 1, required: false, type: Number })
    page = 1;

    @Allow()
    @Transform(({ value }) => Number(value))
    @ApiProperty({ default: 10, required: false, type: Number })
    limit = 10;

    @ApiProperty({ default: 'id', required: false, type: String })
    sortField? = 'id';

    @ApiProperty({ default: '', required: false, type: String })
    @Allow()
    @Transform(({ value }) => value?.trim())
    searchText? = '';

    @ApiProperty({
        default: 'DESC',
        required: false,
        enum: ['ASC', 'DESC'],
        nullable: false,
        type: String,
    })
    sortValue? = 'DESC';

    @Allow()
    @Expose()
    @Transform(({ obj: { sortField, sortValue } }) => {
        const sort = { [String(sortField || 'id')]: String(sortValue || 'DESC') };
        return sort;
    })
    sort?: Record<string, 'ASC' | 'DESC'>;

    @Allow()
    @Transform(({ obj }) => {
        //eslint-disable-next-line
        const { page, limit, sortField, sortValue, searchText, ...dynamicFields } =
            obj;

        // Return only dynamic fields, excluding predefined ones
        return dynamicFields;
    })
    filters: Record<string, any> = {}; // Explicitly handle dynamic fields
}

// Pagination decorator for MikroORM
export const ApiPaginated = <TModel extends Type<any>>(model: TModel) => {
    return applyDecorators(
        ApiExtraModels(model),
        ApiResponse({
            schema: {
                title: `PaginatedResponseOf${model.name}`,
                allOf: [
                    { $ref: getSchemaPath(PaginateResult) },
                    {
                        properties: {
                            docs: {
                                type: 'array',
                                items: { $ref: getSchemaPath(model) },
                            },
                        },
                    },
                ],
            },
        }),
    );
};

// MikroORM-specific pagination utility
export async function paginate<Entity extends object>(
    em: EntityManager,
    entityClass: EntityName<Entity>,
    query: PaginateQuery,
    relations: string[] = [],
    searchableFields: string[] = [], // Add an array of fields to search
): Promise<PaginateResult<Entity>> {
    const { page, limit, searchText, ...additionalFilters } = query;

    let sortField: string | undefined;
    let sortValue: string | undefined;

    // Build where conditions
    const whereConditions: FilterQuery<Entity> = {};

    // Add search text logic
    if (searchText && searchableFields.length > 0) {
        const searchConditions: any[] = [];

        searchableFields.forEach((rawField) => {
            const field = rawField.trim(); // Trim any accidental spaces
            const fieldParts = field.split('.');
            const relation = fieldParts.length > 1 ? fieldParts[0] : undefined;
            const column = fieldParts.length > 1 ? fieldParts[1] : fieldParts[0];

            if (relation) {
                // For relation fields, use nested object structure
                if (!searchConditions.some(cond => cond[relation])) {
                    searchConditions.push({
                        [relation]: {
                            [column]: { $ilike: `%${searchText}%` }
                        }
                    });
                }
            } else {
                // For direct entity fields
                searchConditions.push({
                    [column]: { $ilike: `%${searchText}%` }
                });
            }
        });

        if (searchConditions.length > 0) {
            whereConditions.$or = searchConditions;
        }
    }

    // Validate and apply sorting
    const metadata = em.getMetadata().get(entityClass);
    const validColumns = metadata?.properties ? Object.keys(metadata.properties) : [];
    const validRelations = metadata?.relations ? Object.keys(metadata.relations) : [];

    let orderBy: any = { id: 'ASC' }; // Default sorting

    if (query.sort && typeof query.sort === 'object') {
        const sortEntry = Object.entries(query.sort)[0]; // Get the first entry (e.g., ["bankName", "ASC"])
        if (sortEntry) {
            [sortField, sortValue] = sortEntry; // Destructure key as sortField and value as sortValue
        }

        if (sortField && validColumns.includes(sortField)) {
            orderBy = { [sortField]: sortValue?.toUpperCase() as 'ASC' | 'DESC' };
        } else if (sortField && sortField.includes('.')) {
            const [relation, column] = sortField.split('.');
            if (validRelations.includes(relation)) {
                orderBy = { [relation]: { [column]: sortValue?.toUpperCase() as 'ASC' | 'DESC' } };
            }
        }
    }

    // Apply filters dynamically
    Object.entries(additionalFilters.filters).forEach(([key, value]) => {
        let column = key;
        let relation: string | undefined;

        // Check if key is a relation field (e.g., "client.name")
        if (key.includes('.')) {
            const [rel, field] = key.split('.');
            if (validRelations.includes(rel)) {
                relation = rel;
                column = field;
            }
        }

        if (value !== undefined) {
            if (relation) {
                // Handle relation fields
                if (!(whereConditions as any)[relation]) {
                    (whereConditions as any)[relation] = {};
                }

                if (value.$notIn) {
                    (whereConditions as any)[relation][column] = { $nin: value.$notIn };
                } else if (value.$In) {
                    (whereConditions as any)[relation][column] = { $in: value.$In };
                } else if (typeof value === 'string') {
                    (whereConditions as any)[relation][column] = { $ilike: `%${value}%` };
                } else if (typeof value === 'boolean' || typeof value === 'number') {
                    (whereConditions as any)[relation][column] = value;
                } else if (Array.isArray(value)) {
                    (whereConditions as any)[relation][column] = { $in: value };
                } else if (typeof value === 'object' && value.$between) {
                    (whereConditions as any)[relation][column] = {
                        $gte: value.$between[0],
                        $lte: value.$between[1]
                    };
                } else {
                    throw new Error(`Unsupported filter type for key "${key}"`);
                }
            } else {
                // Handle direct entity fields
                if (validColumns.includes(column)) {
                    if (value.$notIn) {
                        (whereConditions as any)[column] = { $nin: value.$notIn };
                    } else if (value.$In) {
                        (whereConditions as any)[column] = { $in: value.$In };
                    } else if (typeof value === 'string') {
                        (whereConditions as any)[column] = { $ilike: `%${value}%` };
                    } else if (typeof value === 'boolean' || typeof value === 'number') {
                        (whereConditions as any)[column] = value;
                    } else if (Array.isArray(value)) {
                        (whereConditions as any)[column] = { $in: value };
                    } else if (typeof value === 'object' && value.$between) {
                        (whereConditions as any)[column] = {
                            $gte: value.$between[0],
                            $lte: value.$between[1]
                        };
                    } else {
                        throw new Error(`Unsupported filter type for key "${key}"`);
                    }
                }
            }
        }
    });

    try {
        // Build find options
        const findOptions: FindOptions<Entity> = {
            limit,
            offset: (page - 1) * limit,
            orderBy,
        };

        // Add relations (populate in MikroORM)
        if (relations.length > 0) {
            findOptions.populate = relations as any;
        }

        // Execute query and get results
        const [docs, totalDocs] = await em.findAndCount(entityClass, whereConditions, findOptions);

        // Return empty result if no data found
        if (!docs || docs.length === 0) {
            return {
                docs: [],
                totalDocs: 0,
                limit,
                totalPages: 0,
                page,
            };
        }

        return {
            docs: docs as Entity[],
            totalDocs,
            limit,
            totalPages: Math.ceil(totalDocs / limit),
            page,
        };
    } catch (error: any) {
        console.error('Pagination error:', error);
        throw new Error(`Failed to paginate ${entityClass}: ${error.message}`);
    }
}

// Alternative pagination function using repository pattern
export async function paginateWithRepository<Entity extends object>(
    repository: EntityRepository<Entity>,
    query: PaginateQuery,
    relations: string[] = [],
    searchableFields: string[] = [],
): Promise<PaginateResult<Entity>> {
    const em = repository.getEntityManager();
    return paginate(em, repository.getEntityName() as EntityName<Entity>, query, relations, searchableFields);
}
