import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import * as qs from 'qs';
import cors from '@fastify/cors';

import { GameModule } from './game.module';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';
import { AppRpcExceptionFilter } from 'libs/utils/interceptors/AppRpcExceptionFilter';
import { AppExceptionFilter } from 'libs/utils/interceptors/AppExeptionFilter';

const fAdapter = new FastifyAdapter({
  logger: false,
  querystringParser: (str) => qs.parse(str),
  pluginTimeout: 62000,
});

async function bootstrap() {
  await fAdapter.register(cors, { origin: '*' });

  const app = await NestFactory.create<NestFastifyApplication>(
    GameModule,
    fAdapter,
    { logger: new LocalTimeLogger() },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('games');
  app.useGlobalFilters(new AppRpcExceptionFilter());

  // Attach TCP microservice to the SAME app
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.TCP,
      options: {
        host: process.env.GAME_TCP_HOST || '0.0.0.0',
        port: Number(process.env.GAME_TCP_PORT || 3005),
      },
    },
    { inheritAppConfig: true },
  );

  app.useGlobalFilters(new AppExceptionFilter());
  // Start both HTTP and TCP
  await app.startAllMicroservices();
  const httpPort = Number(process.env.GAME_HTTP_PORT || '3010');
  await app.listen(httpPort, '0.0.0.0');
}

bootstrap();
