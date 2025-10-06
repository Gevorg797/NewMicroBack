import { Module } from '@nestjs/common';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule.forRoot(),],
    controllers: [FileUploadController],
    providers: [FileUploadService],
    exports: [FileUploadService],
})
export class FileServiceModule { }
