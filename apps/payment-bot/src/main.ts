import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyPluginCallback } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import * as multer from 'fastify-multer';
import * as qs from 'qs';
import { PaymentBotModule } from './payment-bot.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MikroORM } from '@mikro-orm/core';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';
import { AppExceptionFilter } from 'libs/utils/interceptors/AppExeptionFilter';
import { ResponseInterceptor } from 'libs/utils/interceptors/ResponseInterceptor';

const fAdapter = new FastifyAdapter({
    logger: false,
    querystringParser: (str) => qs.parse(str),
    bodyLimit: 5 * 1024 * 1024,
    pluginTimeout: 200000,
});

fAdapter.register(multer.contentParser);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        PaymentBotModule,
        fAdapter,
        { logger: new LocalTimeLogger() },
    );

    await app.register(fastifyCookie as FastifyPluginCallback);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            stopAtFirstError: true,
            transform: true,
        }),
    );

    app.useGlobalFilters(new AppExceptionFilter());

    app.setGlobalPrefix('payment-bot');

    const config = new DocumentBuilder()
        .setTitle('Payment Bot API Documentation')
        .setDescription('The Payment Bot API description')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    app.useGlobalInterceptors(new ResponseInterceptor());
    const docs = SwaggerModule.createDocument(app, config, {
        deepScanRoutes: true,
    });

    SwaggerModule.setup('/payment-bot/swagger', app, docs);

    app.enableCors({ origin: '*' });

    await app.listen(Number(process.env.PAYMENT_BOT_PORT), '0.0.0.0');
}
void bootstrap();

