import { defineConfig } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ENTITIES } from './libs/database/src/entities';

export default defineConfig({
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  dbName: process.env.DB_NAME || 'bikbet',
  entities: ENTITIES,
  debug: false,
  allowGlobalContext: true,
  driverOptions: {
    connection: {
      ssl: false,
    },
  },
  migrations: {
    path: './migrations',
    pattern: /^[\w-]+\d+\.(ts|js)$/,
  },
});
