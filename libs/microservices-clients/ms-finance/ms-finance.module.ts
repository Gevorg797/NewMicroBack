import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MsFinanceService } from './ms-finance.service';
import { MS_FINANCE_SERVICE } from './tokens';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MS_FINANCE_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.FINANCE_TCP_HOST || 'localhost',
          port: Number(process.env.FINANCE_TCP_PORT || 3008),
        },
      },
    ]),
  ],
  providers: [MsFinanceService],
  exports: [MsFinanceService],
})
export class MsFinanceModule {}
