import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MsFinanceService } from './ms-finance.service';
import { MS_FINANCE } from 'libs/config';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MS_FINANCE,
        transport: Transport.TCP,
        options: {
          host: process.env.FINANCE_HOST,
          port: parseInt(process.env.FINANCE_TCP_PORT ?? '3000'),
        },
      },
    ]),
  ],
  providers: [MsFinanceService],
  exports: [MsFinanceService],
})
export class MsFinanceModule { }
