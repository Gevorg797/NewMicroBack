import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyPluginCallback } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import * as multer from 'fastify-multer';
import * as qs from 'qs';
import { ApiModule } from './api.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MikroORM } from '@mikro-orm/core';

const fAdapter = new FastifyAdapter({
  logger: false,
  querystringParser: (str) => qs.parse(str),
  bodyLimit: 5 * 1024 * 1024,
  pluginTimeout: 60000,
});

fAdapter.register(multer.contentParser);

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    fAdapter,
  );

  await app.register(fastifyCookie as FastifyPluginCallback);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const orm = app.get(MikroORM);
  if (process.env.NODE_ENV === 'dev') {
    const generator = orm.getSchemaGenerator();
    await generator.updateSchema();
    console.log('Database schema updated successfully!');
  }

  const docs = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('/api/swagger', app, docs);

  app.enableCors({ origin: '*' });

  await app.listen(3001, 'localhost');
}
void bootstrap();
