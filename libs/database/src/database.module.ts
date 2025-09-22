import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import * as path from 'path';
import { microOrmConfig } from './config/mikro-orm.config';
import { ENTITIES } from './entities';
import { DatabaseSyncService } from './database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(
        process.cwd(),
        `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`,
      ),
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      driver: PostgreSqlDriver,
      useFactory: microOrmConfig,
    }),
    MikroOrmModule.forFeature(ENTITIES),
  ],
  providers: [DatabaseSyncService],
  exports: [MikroOrmModule],
})
export class DatabaseModule { }
