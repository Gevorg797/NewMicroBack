import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { FileServiceModule } from './file-service.module';
import { LocalTimeLogger } from 'libs/utils/logger/locale-time-logger';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        FileServiceModule,
        {
            transport: Transport.TCP,
            options: {
                host: process.env.FILE_SERVICE_HOST || '0.0.0.0',
                port: Number(process.env.FILE_SERVICE_PORT) || 3003,
            },
            logger: new LocalTimeLogger(),
        },
    );

    await app.listen();
}
void bootstrap();
