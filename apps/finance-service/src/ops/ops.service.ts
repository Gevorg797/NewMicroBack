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
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';
import axios from 'axios';
import { PaymentNotificationService } from '../notifications/payment-notification.service';

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
    private readonly notificationService: PaymentNotificationService,
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

    const { status, transactionId, clientTransactionId, clientUserId, amount } =
      body;

    let numericAmount = Number(amount ?? 0);

    if (!clientTransactionId) {
      throw new Error('clientTransactionId is required');
    }

    const transaction = await this.transactionManager.getTransaction(
      Number(clientTransactionId),
      [
        'user',
        'subMethod.method.providerSettings',
        'subMethod.method.providerSettings.provider',
      ],
    );

    const providerName =
      transaction.subMethod?.method?.providerSettings?.provider?.name ?? 'OPS';

    if (!numericAmount) {
      numericAmount = Number(transaction.amount ?? 0);
    }

    if (transaction.status === PaymentTransactionStatus.COMPLETED) {
      return { data: 'already-processed' };
    }

    if (clientUserId && String(transaction.user.id) !== String(clientUserId)) {
      throw new Error('User ID mismatch');
    }

    if (status?.toLowerCase() === 'failed') {
      await this.transactionManager.failTransaction(
        transaction.id as number,
        'OPS payment failed',
      );

      await this.notificationService.notifyDepositFailure({
        userTelegramId: transaction.user.telegramId,
        transactionId: transaction.id as number,
        amount: numericAmount,
        providerName,
        reason: status,
      });

      return { data: 'failed' };
    }

    if (status?.toLowerCase() === 'completed') {
      const paymentReference = transactionId
        ? String(transactionId)
        : (transaction.paymentTransactionId ?? `ops-${transaction.id}`);

      await this.transactionManager.completePayin(
        transaction.id as number,
        numericAmount,
        paymentReference,
      );

      await this.notificationService.notifyDepositSuccess({
        userTelegramId: transaction.user.telegramId,
        transactionId: transaction.id as number,
        amount: numericAmount,
        providerName,
      });

      return { data: 'completed' };
    }

    return { data: 'pending' };
  }

  async handleUrlCallback(payload: CallbackPayload) {
    const { body } = payload;

    const { transactionId, clientTransactionId, redirectUrl } = body;

    if (!clientTransactionId) {
      throw new Error('clientTransactionId is required');
    }

    if (!redirectUrl) {
      throw new Error('redirectUrl is required');
    }

    // Find transaction by clientTransactionId (which is our transaction.id)
    const em = this.financeTransactionRepo.getEntityManager();
    const transaction = await em.findOne(
      FinanceTransactions,
      { id: Number(clientTransactionId) },
      {
        populate: ['user', 'subMethod.method.providerSettings'],
      },
    );

    if (!transaction) {
      throw new Error(`Transaction with ID ${clientTransactionId} not found`);
    }

    // Update transaction with redirectUrl and paymentTransactionId
    transaction.redirectSuccessUrl = redirectUrl;
    if (transactionId) {
      transaction.paymentTransactionId = String(transactionId);
    }

    // Persist and flush the changes
    await em.persistAndFlush(transaction);

    return { data: 'success' };
  }
}
