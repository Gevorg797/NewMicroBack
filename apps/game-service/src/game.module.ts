import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { SuperomaticModule } from './Superomatic-v2/superomatic.module';

@Module({
    imports: [DatabaseModule, SuperomaticModule],
    controllers: [],
    providers: [],
    exports: [],
})
export class GameModule { }