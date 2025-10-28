import { Module } from '@nestjs/common';
import { WheelService } from './wheel.service';
import { WheelController } from './wheel.controller';

@Module({
    controllers: [WheelController],
    providers: [WheelService],
    exports: [WheelService],
})
export class WheelModule { }


