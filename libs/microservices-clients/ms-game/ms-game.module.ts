import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MsGameService } from './ms-game.service';
import { MS_GAME } from './tokens';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MS_GAME,
        transport: Transport.TCP,
        options: {
          host: process.env.GAME_TCP_HOST || '0.0.0.0',
          port: parseInt(process.env.GAME_TCP_PORT || '3005'),
        },
      },
    ]),
  ],
  providers: [MsGameService],
  exports: [MsGameService],
})
export class MsGameModule { }
