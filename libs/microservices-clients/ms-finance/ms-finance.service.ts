import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MS_FINANCE_SERVICE } from './tokens';
import { firstValueFrom } from 'rxjs';

export interface CreatePayinDto {
  userId: number;
  amount: number;
  methodId: number;
  uuId?: string;
}

export interface CreatePayoutDto {
  userId: number;
  amount: number;
  methodId: number;
  requisite?: string;
}

@Injectable()
export class MsFinanceService {
  private readonly logger = new Logger(MsFinanceService.name);

  constructor(
    @Inject(MS_FINANCE_SERVICE) private readonly client: ClientProxy,
  ) {}

  /**
   * Create payin (deposit) order
   */
  async createPayin(data: CreatePayinDto): Promise<any> {
    try {
      const result = await firstValueFrom(
        this.client.send('finance.payin.create', data),
      );

      if (!result.success) {
        throw new Error(result.error || 'Payin failed');
      }

      return result.data;
    } catch (error) {
      this.logger.error(`Payin request failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create payout (withdrawal) order
   */
  async createPayout(data: CreatePayoutDto): Promise<any> {
    try {
      const result = await firstValueFrom(
        this.client.send('finance.payout.create', data),
      );

      if (!result.success) {
        throw new Error(result.error || 'Payout failed');
      }

      return result.data;
    } catch (error) {
      this.logger.error(`Payout request failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
