import { Injectable, OnModuleInit } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

@Injectable()
export class DatabaseSyncService implements OnModuleInit {
  private readonly logger = new LocalTimeLogger('DatabaseBootstrap');

  constructor(private readonly orm: MikroORM) { }

  async onModuleInit() {
    // if (process.env.NODE_ENV === 'dev') {
    const generator = this.orm.getSchemaGenerator();
    await generator.updateSchema();
    this.logger.log('Database schema updated successfully!');
    // }
  }
}
