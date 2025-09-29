import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreatePayinOrderDto } from 'apps/finance-service/src/freekassa/dto/create-payin-order.dto';
import { FINANCE_PATTERNS, MS_FINANCE } from 'libs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MsFinanceService {
  constructor(@Inject(MS_FINANCE) private readonly client: ClientProxy) { }

  freekassaCreatePayin(data: CreatePayinOrderDto) {
    return firstValueFrom(this.client.send(FINANCE_PATTERNS.FREEKASSA_CREATE_PAYIN, data));
  }

  cryptobotCreatePayin(data: any) {
    return firstValueFrom(this.client.send(FINANCE_PATTERNS.CRYPTOBOT_CREATE_PAYIN, data))
  }

  cryptobotCreatePayout(data: any) {
    return firstValueFrom(this.client.send(FINANCE_PATTERNS.CRYPTOBOT_CREATE_PAYOUT, data))
  }
}
