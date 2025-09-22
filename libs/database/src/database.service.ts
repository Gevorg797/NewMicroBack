import { ConsoleLogger, Injectable, OnModuleInit } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';


@Injectable()
export class DatabaseSyncService implements OnModuleInit {
    private readonly logger = new ConsoleLogger('DatabaseBootstrap');

    constructor(private readonly orm: MikroORM) { }

    async onModuleInit() {
        if (process.env.NODE_ENV === 'dev') {
            const generator = this.orm.getSchemaGenerator();
            await generator.updateSchema();
            this.logger.log('Database schema updated successfully!');
        }
    }
}
