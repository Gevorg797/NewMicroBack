import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MsFileService } from './ms-file.service';
import { MS_FILE } from './tokens';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: MS_FILE,
                transport: Transport.TCP,
                options: {
                    host: process.env.FILE_SERVICE_HOST || 'localhost',
                    port: parseInt(process.env.FILE_SERVICE_PORT || '3003'),
                },
            },
        ]),
    ],
    providers: [MsFileService],
    exports: [MsFileService],
})
export class MsFileModule { }
