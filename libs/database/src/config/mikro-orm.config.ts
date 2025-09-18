import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { ENTITIES } from '../entities';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

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
    debug: configService.get<string>('NODE_ENV') !== 'production',
  };
}
