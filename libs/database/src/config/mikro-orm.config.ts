import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ENTITIES } from '../entities';

export function microOrmConfig(
  configService: ConfigService,
): MikroOrmModuleOptions {
  return {
    driver: PostgreSqlDriver,
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    user: configService.get<string>('DB_USER'),
    password: configService.get<string>('DB_PASSWORD'),
    dbName: configService.get<string>('DB_NAME'),
    entities: ENTITIES,
    debug: false,
    allowGlobalContext: true,
    driverOptions: {
      connection: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    },
  };
}
