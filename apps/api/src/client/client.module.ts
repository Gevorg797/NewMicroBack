import { Module } from '@nestjs/common';
import { PaymentModule } from './payment/payment.module';
import { GameModule } from './game/game.module';

@Module({
    imports: [PaymentModule, GameModule],
    exports: [PaymentModule, GameModule],
})
export class ClientModule { }

