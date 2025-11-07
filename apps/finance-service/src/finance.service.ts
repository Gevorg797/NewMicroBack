import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  FinanceTransactions,
  FinanceProviderSubMethods,
  User,
  Currency,
} from '@lib/database';
import {
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentTransactionUserResponseStatus,
} from '@lib/database/entities/finance-provider-transactions.entity';
import { PaymentProviderFactory } from './strategies/payment-provider.factory';
import {
  PaymentPayload,
  PayoutPayload,
  CallbackPayload,
  PaymentResult,
} from './interfaces/payment-provider.interface';
import { TransactionManagerService } from './repository/transaction-manager.service';
import { CreatePayinDto, CreatePayoutDto } from './dto/create-payment.dto';
import { PaymentNotificationService } from './notifications/payment-notification.service';
import { InsufficientBalanceException } from './exceptions/finance-service.exceptions';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly providerFactory: PaymentProviderFactory,
    private readonly transactionManager: TransactionManagerService,
    @InjectRepository(FinanceTransactions)
    private readonly financeTransactionRepo: EntityRepository<FinanceTransactions>,
    @InjectRepository(FinanceProviderSubMethods)
    private readonly subMethodsRepo: EntityRepository<FinanceProviderSubMethods>,
    private readonly notificationService: PaymentNotificationService,
  ) {
    this.logger.log('FinanceService initialized');
  }

  /**
   * Create payin (deposit) order
   */
  async createPayinOrder(
    providerName: string,
    payload: PaymentPayload,
  ): Promise<PaymentResult> {
    this.logger.debug(
      `Creating payin order for provider ${providerName}, transaction ${payload.transactionId}`,
    );

    const provider = this.providerFactory.getProviderStrategy(providerName);
    const result = await provider.createPayinOrder(payload);

    this.logger.log(
      `Payin order created for transaction ${payload.transactionId}`,
    );
    return result;
  }

  /**
   * Create payout (withdrawal) order
   */
  async createPayoutOrder(
    providerName: string,
    payload: PayoutPayload,
  ): Promise<any> {
    this.logger.debug(
      `Creating payout order for provider ${providerName}, transaction ${payload.transactionId}`,
    );

    const provider = this.providerFactory.getProviderStrategy(providerName);
    const result = await provider.createPayoutProcess(payload);

    this.logger.log(
      `Payout order created for transaction ${payload.transactionId}`,
    );
    return result;
  }

  /**
   * Handle payment callback/webhook
   */
  async handleCallback(
    providerName: string,
    payload: CallbackPayload,
  ): Promise<void> {
    this.logger.debug(`Handling callback for provider ${providerName}`);

    const provider = this.providerFactory.getProviderStrategy(providerName);
    await provider.handleCallback(payload);

    this.logger.log(`Callback processed for provider ${providerName}`);
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    return this.providerFactory.getAvailableProviders();
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: number, populate: string[] = []) {
    return this.transactionManager.getTransaction(transactionId, populate);
  }

  /**
   * Process payin (deposit) - Create transaction and initiate payment
   */
  async processPayin(data: CreatePayinDto): Promise<any> {
    this.logger.log(
      `Processing payin for user ${data.userId}, amount ${data.amount}`,
    );

    // Get payment method with provider settings
    const subMethod = await this.subMethodsRepo.findOne(
      { id: data.methodId },
      {
        populate: [
          'method.providerSettings',
          'method.providerSettings.provider',
        ],
      },
    );

    if (!subMethod) {
      return { error: 'Payment method not found' };
    }

    if (!subMethod.isEnabled) {
      return { error: 'Payment method is not available' };
    }

    if (subMethod.minAmount > data.amount) {
      return { error: `Minimum amount is ${subMethod.minAmount}` };
    }

    if (subMethod.maxAmount < data.amount) {
      return { error: `Maximum amount is ${subMethod.maxAmount}` };
    }

    if (!subMethod.method.providerSettings) {
      return { error: 'Provider settings not found' };
    }

    // Get user's main balance to get currency
    const user = await this.financeTransactionRepo
      .getEntityManager()
      .findOne(User, { id: data.userId });

    if (!user) {
      return { error: 'User not found' };
    }

    const mainBalance = await this.transactionManager.getMainBalance(user);

    // Create transaction
    const transaction = this.financeTransactionRepo.create({
      amount: data.amount,
      type: PaymentTransactionType.PAYIN,
      subMethod,
      user: this.financeTransactionRepo
        .getEntityManager()
        .getReference(User, data.userId),
      currency: this.financeTransactionRepo
        .getEntityManager()
        .getReference(Currency, mainBalance.currency.id as number),
      status: PaymentTransactionStatus.PENDING,
      userResponseStatus: PaymentTransactionUserResponseStatus.PENDING,
    });

    await this.financeTransactionRepo
      .getEntityManager()
      .persistAndFlush(transaction);

    this.logger.log(`Created transaction ${transaction.id}`);

    // Initiate payment with provider
    const providerName =
      subMethod.method.providerSettings.provider.name.toLowerCase();

    try {
      const result = await this.createPayinOrder(providerName, {
        transactionId: transaction.id as number,
        amount: data.amount,
      });

      this.logger.log(
        `Payin initiated successfully for transaction ${transaction.id}`,
      );
      return result;
    } catch (error) {
      // Mark transaction as failed
      await this.transactionManager.failTransaction(
        transaction.id as number,
        error.message,
      );
      return { error: error };
    }
  }

  /**
   * Process payout (withdrawal) - Create transaction and initiate payout
   */
  async processPayout(data: CreatePayoutDto): Promise<any> {
    this.logger.log(
      `Processing payout for user ${data.userId}, amount ${data.amount}`,
    );

    let providerName = 'Unknown';
    let user: User | null = null;
    let transaction: FinanceTransactions | null = null;

    // Get payment method with provider settings
    try {
      const subMethod = await this.subMethodsRepo.findOne(
        { id: data.methodId },
        {
          populate: [
            'method.providerSettings',
            'method.providerSettings.provider',
          ],
        },
      );

      if (!subMethod) {
        throw new Error('Payment method not found');
      }

      providerName =
        subMethod.method.providerSettings?.provider?.name || 'Unknown';

      // Get user and check balance
      user = await this.financeTransactionRepo
        .getEntityManager()
        .findOne(User, { id: data.userId });

      if (!user) {
        throw new Error('User not found');
      }

      const mainBalance = await this.transactionManager.checkSufficientBalance(
        user,
        data.amount,
      );

      // Create transaction
      transaction = this.financeTransactionRepo.create({
        amount: data.amount,
        type: PaymentTransactionType.PAYOUT,
        subMethod,
        requisite: data.requisite,
        user: this.financeTransactionRepo
          .getEntityManager()
          .getReference(User, data.userId),
        currency: this.financeTransactionRepo
          .getEntityManager()
          .getReference(Currency, mainBalance.currency.id as number),
        status: PaymentTransactionStatus.PENDING,
        userResponseStatus: PaymentTransactionUserResponseStatus.PENDING,
      });

      if (!transaction) {
        throw new Error('Failed to create transaction');
      }

      // Debit the amount from user's main balance (ensures balance >= 0)
      await this.transactionManager.debitBalance(
        user,
        data.amount,
        transaction,
      );

      this.logger.log(
        `Debited ${data.amount} from user ${user.id} for payout transaction ${transaction.id}`,
      );

      // Only process automated payouts for CryptoBot
      // if (providerName.toLowerCase() === 'cryptobot') {
      //   try {
      //     const result = await this.createPayoutOrder(providerName, {
      //       transactionId: transaction.id as number,
      //       amount: data.amount,
      //       requisite: data.requisite,
      //       to: data.requisite,
      //     });

      //     this.logger.log(
      //       `Payout initiated successfully for transaction ${transaction.id}`,
      //     );
      //     return result;
      //   } catch (error) {
      //     // Mark transaction as failed and refund balance
      //     this.logger.warn(
      //       `CryptoBot payout failed for transaction ${transaction.id}: ${error.message}. Refunding balance...`,
      //     );
      //     await this.transactionManager.failPayoutAndRefund(
      //       transaction.id as number,
      //     );
      //     this.logger.log(
      //       `Balance refunded for failed transaction ${transaction.id}`,
      //     );
      //     throw error;
      //   }
      // }

      // For other providers (manual processing), just return the transaction
      return transaction;
    } catch (error: any) {
      const isKnownError = this.isKnownPayoutError(error);

      if (!isKnownError) {
        await this.handleUnexpectedPayoutFailure({
          error,
          transaction,
          user,
          amount: data.amount,
          providerName,
          methodId: data.methodId,
        });
      }

      if (isKnownError) {
        throw error;
      }

      throw new Error('Сервис вывода временно недоступен. Попробуйте позже.');
    }
  }

  /**
   * Reject payout - Fail transaction and refund balance
   */
  async rejectPayout(transactionId: number): Promise<any> {
    this.logger.log(`Rejecting payout transaction ${transactionId}`);

    await this.transactionManager.failPayoutAndRefund(transactionId);

    this.logger.log(
      `Payout transaction ${transactionId} rejected and refunded`,
    );

    return { success: true, message: 'Payout rejected and balance refunded' };
  }

  async completePayout(
    transactionId: number,
    paymentTransactionId?: string,
  ): Promise<any> {
    this.logger.log(`Completing payout transaction ${transactionId}`);

    const reference =
      paymentTransactionId || `manual-${transactionId}-${Date.now()}`;

    await this.transactionManager.completePayout(transactionId, reference);

    this.logger.log(`Payout transaction ${transactionId} marked as completed`);

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      ['user', 'subMethod', 'currency'],
    );

    return transaction;
  }

  private isKnownPayoutError(error: any): boolean {
    if (!error) {
      return false;
    }

    if (error instanceof InsufficientBalanceException) {
      return true;
    }

    const message = error.message || '';

    return (
      message === 'Payment method not found' || message === 'User not found'
    );
  }

  private mapErrorToUserReason(error: any): string {
    const message = error?.message || '';

    if (message.includes('ETIMEDOUT')) {
      return 'Время ожидания ответа от платежного сервиса истекло.';
    }

    if (message.toLowerCase().includes('timeout')) {
      return 'Превышено время ожидания ответа сервиса вывода.';
    }

    return 'Техническая ошибка. Попробуйте позже.';
  }

  private mapErrorToTechnicalMessage(error: any): string {
    if (!error) {
      return 'Unknown error';
    }

    if (error.stack) {
      return error.message || 'Error without message';
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return `${error}`;
    }
  }

  private async handleUnexpectedPayoutFailure(params: {
    error: any;
    transaction: FinanceTransactions | null;
    user: User | null;
    amount: number;
    providerName: string;
    methodId: number;
  }): Promise<void> {
    const { error, transaction, user, amount, providerName, methodId } = params;

    this.logger.error(
      `Unexpected payout failure for user ${user?.id ?? 'unknown'}: ${error?.message}`,
      error?.stack,
    );

    if (transaction?.id) {
      try {
        await this.transactionManager.failPayoutAndRefund(
          Number(transaction.id),
        );
      } catch (refundError: any) {
        this.logger.warn(
          `Failed to refund payout transaction ${transaction.id}: ${refundError?.message}`,
        );
      }
    }

    try {
      await this.notificationService.notifyPayoutFailure({
        userTelegramId: user?.telegramId,
        transactionId: transaction?.id ? Number(transaction.id) : undefined,
        amount,
        providerName,
        methodId,
        reason: this.mapErrorToUserReason(error),
        technicalMessage: this.mapErrorToTechnicalMessage(error),
      });
    } catch (notifyError: any) {
      this.logger.warn(
        `Failed to send payout failure notification: ${notifyError?.message}`,
      );
    }
  }
}
