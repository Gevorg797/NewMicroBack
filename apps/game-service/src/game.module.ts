import { DatabaseModule } from '@lib/database';
import { Module } from '@nestjs/common';
import { SuperomaticModule } from './Superomatic-v2/superomatic.module';
import { B2BSlotsModule } from './B2BSlots-v1/b2bslots.module';

@Module({
    imports: [DatabaseModule, SuperomaticModule, B2BSlotsModule],
    controllers: [],
    providers: [],
    exports: [],
})
export class GameModule { }