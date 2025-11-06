import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  IPaymentProvider,
  PaymentPayload,
  PayoutPayload,
  CallbackPayload,
  PaymentResult,
} from '../interfaces/payment-provider.interface';
import { TransactionManagerService } from '../repository/transaction-manager.service';
import axios from 'axios';

@Injectable()
export class OpsService implements IPaymentProvider {
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly financeProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionRepo: EntityRepository<FinanceTransactions>,
    readonly transactionManager: TransactionManagerService,
  ) {}

  async createPayinOrder(payload: PaymentPayload) {
    const { transactionId, amount } = payload;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      [
        'subMethod.method.providerSettings',
        'subMethod.method',
        'user',
        'currency',
      ],
    );

    if (!transaction) {
      return { error: 'Transaction not found' };
    }

    if (!transaction.subMethod.method.providerSettings) {
      return { error: 'Provider settings not found' };
    }

    const apiUrl = `${transaction.subMethod.method.providerSettings.baseURL}/payin/process`;

    const requestData = {
      amount: Number(amount),
      currencyId: 1,
      methodId: Number(transaction.subMethod.method.value),
      shopId: transaction.subMethod.method.providerSettings.shopId,
      privateKey: transaction.subMethod.method.providerSettings.privateKey,
      clientTransactionId: String(transaction.id),
      clientUserId: String(transaction.user.id),
      callbackUrl: transaction.subMethod.method.providerSettings.callbackUrl,
      responseCallbackUrl:
        transaction.subMethod.method.providerSettings.paymentFormLink,
      clientUserIp: '1.1.1.1',
      backUrl: 'bik-bet.com',
    };

    try {
      const response = await axios.post(apiUrl, requestData);
      const result = response.data;

      if (result.data?.transactionId) {
        // Store OPS transaction ID for callback matching
        transaction.paymentTransactionId = String(result.data.transactionId);
        await this.financeTransactionRepo
          .getEntityManager()
          .persistAndFlush(transaction);
      }

      return {
        data: { transactionId: transaction.id },
      };
    } catch (error) {
      // Log detailed error information
      console.log(error.response?.data || error.message);

      return {
        error: 'Payin logic not implemented yet',
      };
    }
  }

  async createPayoutProcess(payload: PayoutPayload): Promise<any> {
    const { transactionId, amount, requisite } = payload;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      ['subMethod.method.providerSettings', 'subMethod.method', 'user'],
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (!transaction.subMethod.method.providerSettings) {
      throw new Error('Provider settings not found');
    }

    // TODO: Implement payout logic here
    // This is a placeholder structure - you can implement the actual payout logic

    return {
      success: false,
      error: 'Payout logic not implemented yet',
    };
  }

  async handleCallback(payload: CallbackPayload) {
    const { body } = payload;

    // TODO: Implement callback handling logic here
    // This is a placeholder structure - you can implement the actual callback logic

    console.log('Ops callback received:', body);

    return { data: 'success' };
  }

  async handleUrlCallback(payload: CallbackPayload) {
    const { body } = payload;

    // TODO: Implement callback handling logic here
    // This is a placeholder structure - you can implement the actual callback logic

    console.log('Ops callback received:', body);

    return { data: 'success' };
  }
}
