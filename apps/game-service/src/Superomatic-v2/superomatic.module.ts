import { Module } from '@nestjs/common';
import { SuperomaticController } from './superomatic.controller';
import { SuperomaticService } from './superomatic.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true,
    })],
    controllers: [SuperomaticController],
    providers: [SuperomaticService],
    exports: [SuperomaticService],
})
export class SuperomaticModule { }