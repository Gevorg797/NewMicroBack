import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { EntityRepository } from '@mikro-orm/postgresql';
import axios from 'axios';
import { randomUUID } from 'crypto';
import {
  IPaymentProvider,
  PaymentPayload,
  PayoutPayload,
  CallbackPayload,
  PaymentResult,
} from '../interfaces/payment-provider.interface';
import { TransactionManagerService } from '../repository/transaction-manager.service';
import { PaymentNotificationService } from '../notifications/payment-notification.service';

@Injectable()
export class PlategaService implements IPaymentProvider {
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

  async createPayinOrder(payload: PaymentPayload): Promise<PaymentResult> {
    const { transactionId, amount, params } = payload;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      [
        'subMethod.method.providerSettings',
        'subMethod.method.providerSettings.provider',
        'subMethod.method',
        'user',
      ],
    );

    const providerSettings = transaction?.subMethod.method.providerSettings;
    const merchantId = providerSettings.publicKey as string; // X-MerchantId
    const secretKey = providerSettings.privateKey as string; // X-Secret

    if (!merchantId || !secretKey) {
      return { error: 'Platega credentials not configured properly' };
    }

    const apiUrl = `${providerSettings.baseURL}/transaction/process`;

    const headers = {
      'Content-Type': 'application/json',
      'X-MerchantId': merchantId,
      'X-Secret': secretKey,
    };

    // Generate UUID for Platega transaction ID
    const plategaTransactionId = randomUUID();

    const data = {
      command: 'pay',
      paymentMethod: 2,
      id: plategaTransactionId,
      paymentDetails: {
        amount: parseInt(String(amount)),
        currency: 'RUB',
      },
      description: 'Пополнение баланса Bilumsmm',
      return: 'https://t.me/Bilumsmm_bot',
      failedUrl: 'https://t.me/Bilumsmm_bot',
      payload: String(transaction.id),
    };

    try {
      const response = await axios.post(apiUrl, data, { headers });
      const result = response.data;

      const redirectUrl = result.redirect;

      if (!redirectUrl) {
        return { error: 'No redirect URL received from Platega' };
      }

      // Store Platega transaction ID for callback matching
      transaction.paymentTransactionId = plategaTransactionId;
      await this.financeTransactionRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      // Try to get QR code
      let qrUrl: any | null = null;

      qrUrl = await this.getQRCode(plategaTransactionId);

      if (qrUrl.error) {
        return { error: qrUrl.error };
      }
      return {
        paymentUrl: qrUrl || undefined,
      };
    } catch (error) {
      // Log detailed error information
      console.log(error.response?.data || error.message);

      return { error: 'Platega request failed' };
    }
  }

  /**
   * Get QR code URL for a transaction
   */
  private async getQRCode(
    plategaTransactionId: string,
  ): Promise<string | { error: string }> {
    const url = `https://app.platega.io/transaction/${plategaTransactionId}`;

    try {
      const response = await axios.get(url);
      const result = response.data;

      const qr = result.qr;

      if (!qr) {
        return { error: 'QR code not available' };
      }

      return qr;
    } catch (error) {
      return { error: 'Failed to get QR code' };
    }
  }

  async createPayoutProcess(payload: PayoutPayload): Promise<any> {
    const { transactionId, amount, requisite, params } = payload;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      [
        'subMethod.method.providerSettings',
        'subMethod.method.providerSettings.provider',
        'subMethod.method',
        'user',
      ],
    );

    const providerSettings = transaction?.subMethod.method.providerSettings;
    const merchantId = providerSettings.publicKey as string;
    const secretKey = providerSettings.privateKey as string;

    if (!merchantId || !secretKey) {
      throw new BadRequestException(
        'Platega credentials not configured properly',
      );
    }

    const apiUrl = `${providerSettings.baseURL}/transaction/process`;

    const headers = {
      'Content-Type': 'application/json',
      'X-MerchantId': merchantId,
      'X-Secret': secretKey,
    };

    // Generate UUID for Platega transaction ID
    const plategaTransactionId = randomUUID();

    // Determine payment method type from params
    const paymentType = params?.paymentType || 'sbp'; // default to sbp
    const paymentMethod = paymentType === 'card' ? 1 : 2; // 1 for card, 2 for SBP

    const data = {
      command: 'payout',
      paymentMethod: paymentMethod,
      id: plategaTransactionId,
      paymentDetails: {
        amount: parseInt(String(amount)),
        currency: 'RUB',
        cardNumber: paymentType === 'card' ? requisite : undefined,
        phoneNumber: paymentType === 'sbp' ? requisite : undefined,
      },
      description: 'Вывод средств Bilumsmm',
      payload: String(transaction.id),
    };

    try {
      const response = await axios.post(apiUrl, data, { headers });
      const result = response.data;

      // Store Platega transaction ID for callback matching
      transaction.paymentTransactionId = plategaTransactionId;
      await this.financeTransactionRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      return {
        success: true,
        transactionId: plategaTransactionId,
        requisite: requisite,
        status: result.status || 'processing',
      };
    } catch (error) {
      console.log(
        'Platega payout error:',
        error.response?.data || error.message,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorData = error.response?.data;
      const errorDetails = errorData?.errors
        ? JSON.stringify(errorData.errors)
        : '';
      const providerMessage =
        errorData?.title ||
        errorData?.message ||
        errorData?.error ||
        error.message;

      throw new BadRequestException(
        `Platega payout failed: ${providerMessage}${errorDetails ? ` | Validation errors: ${errorDetails}` : ''}`,
      );
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    const { body } = payload;
    const { id, status, amount } = body;

    // Find transaction by Platega transaction ID (stored in paymentTransactionId)
    const transaction = await this.financeTransactionRepo.findOne(
      { paymentTransactionId: id },
      {
        populate: [
          'subMethod.method.providerSettings',
          'subMethod.method.providerSettings.provider',
          'user',
          'currency',
        ],
      },
    );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with Platega ID ${id} not found`,
      );
    }

    this.transactionManager.validateTransactionNotProcessed(transaction);

    // Validate amount
    if (transaction.amount !== parseFloat(amount)) {
      throw new BadRequestException('Amount mismatch');
    }

    // Handle different statuses
    const providerName =
      transaction.subMethod?.method?.providerSettings?.provider?.name ||
      'Platega';

    if (status === 'success' || status === 'completed' || status === 'paid') {
      await this.transactionManager.completePayin(
        transaction.id as number,
        Number(amount),
        String(id),
      );

      await this.notificationService.notifyDepositSuccess({
        userTelegramId: transaction.user.telegramId,
        transactionId: transaction.id as number,
        amount: Number(amount),
        providerName,
      });
    } else if (status === 'failed' || status === 'cancelled') {
      await this.transactionManager.failTransaction(
        transaction.id as number,
        `Payment ${status}`,
      );

      await this.notificationService.notifyDepositFailure({
        userTelegramId: transaction.user.telegramId,
        transactionId: transaction.id as number,
        amount: Number(amount),
        providerName,
        reason: `Payment ${status}`,
      });
    }
    // For other statuses (pending, processing), do nothing and wait for next callback
  }
}
