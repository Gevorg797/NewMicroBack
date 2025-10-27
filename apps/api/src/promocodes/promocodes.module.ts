import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PromocodesService } from './promocodes.service';
import { PromocodesController } from './promocodes.controller';
import {
    Promocode,
    PromocodeUsage,
    User,
    Balances,
} from '@lib/database';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            Promocode,
            PromocodeUsage,
            User,
            Balances,
        ]),
    ],
    controllers: [PromocodesController],
    providers: [PromocodesService],
    exports: [PromocodesService],
})
export class PromocodesModule { }
