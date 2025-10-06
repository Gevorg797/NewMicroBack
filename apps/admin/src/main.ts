import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyPluginCallback } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import * as multer from 'fastify-multer';
import qs from 'qs';
import { AdminModule } from './admin.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppExceptionFilter } from 'libs/utils/interceptors/AppExeptionFilter';
import { ResponseInterceptor } from 'libs/utils/interceptors/ResponseInterceptor';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

const fAdapter = new FastifyAdapter({
  logger: false,
  querystringParser: (str: string) => qs.parse(str),
  pluginTimeout: 600000,
  bodyLimit: 1048576 * 5,
});

fAdapter.register(multer.contentParser);

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AdminModule,
    fAdapter,
    { logger: new LocalTimeLogger() },
  );

  await app.register(fastifyCookie as FastifyPluginCallback);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  // Add global interceptors
  app.useGlobalFilters(new AppExceptionFilter());

  app.setGlobalPrefix('admin');

  const config = new DocumentBuilder()
    .setTitle('Admin API')
    .setDescription('The Admin API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  app.useGlobalInterceptors(new ResponseInterceptor());
  const docs = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('/admin/swagger', app, docs);

  app.enableCors({
    origin: '*',
  });

  await app.listen(Number(process.env.ADMIN_PORT), '0.0.0.0');
}

void bootstrap();
