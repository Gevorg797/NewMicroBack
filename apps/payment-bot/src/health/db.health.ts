import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { EntityManager } from '@mikro-orm/postgresql';

@Injectable()
export class MikroOrmHealthIndicator extends HealthIndicator {
    constructor(private readonly em: EntityManager) {
        super();
    }

    async pingCheck(key: string): Promise<HealthIndicatorResult> {
        try {
            await this.em.getConnection().execute('select 1');
            return this.getStatus(key, true);
        } catch (error: any) {
            const result = this.getStatus(key, false, { message: error?.message });
            throw new HealthCheckError('Database check failed', result);
        }
    }
}

