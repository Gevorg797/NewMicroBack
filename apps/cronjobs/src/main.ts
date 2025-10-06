import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { ValidationPipe } from '@nestjs/common';
import * as qs from 'qs';
import * as multer from 'fastify-multer';

import { AppExceptionFilter } from 'libs/utils/interceptors/AppExeptionFilter';
import { CronjobsModule } from './cronjobs.module';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

const fAdapter = new FastifyAdapter({
    logger: false,
    querystringParser: (str) => qs.parse(str),
    pluginTimeout: 62000,
});

fAdapter.register(multer.contentParser);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        CronjobsModule,
        fAdapter,
        { logger: new LocalTimeLogger() },
    );

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            stopAtFirstError: true,

            // skipUndefinedProperties: true,
        }),
    );

    app.useGlobalFilters(new AppExceptionFilter());
    app.setGlobalPrefix('cronjobs');

    app.enableCors({
        origin: '*',
    });

    await app.listen(Number(process.env.CRONJOBS_PORT), '0.0.0.0');
}
bootstrap();
