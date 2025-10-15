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
      throw new Error('Payment method not found');
    }

    if (!subMethod.isEnabled) {
      throw new Error('Payment method is not available');
    }

    if (subMethod.minAmount > data.amount) {
      throw new Error(`Minimum amount is ${subMethod.minAmount}`);
    }

    if (subMethod.maxAmount < data.amount) {
      throw new Error(`Maximum amount is ${subMethod.maxAmount}`);
    }

    if (!subMethod.method.providerSettings) {
      throw new Error('Provider settings not found');
    }

    // Get user's main balance to get currency
    const user = await this.financeTransactionRepo
      .getEntityManager()
      .findOne(User, { id: data.userId });

    if (!user) {
      throw new Error('User not found');
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
      throw error;
    }
  }

  /**
   * Process payout (withdrawal) - Create transaction and initiate payout
   */
  async processPayout(data: CreatePayoutDto): Promise<any> {
    this.logger.log(
      `Processing payout for user ${data.userId}, amount ${data.amount}`,
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
      throw new Error('Payment method not found');
    }
    // Get user and check balance
    const user = await this.financeTransactionRepo
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
    const transaction = this.financeTransactionRepo.create({
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

    await this.financeTransactionRepo
      .getEntityManager()
      .persistAndFlush(transaction);

    return transaction;
    // Initiate payout with provider
    // const providerName =
    //   subMethod.method.providerSettings.provider.name.toLowerCase();

    // try {
    //   const result = await this.createPayoutOrder(providerName, {
    //     transactionId: transaction.id as number,
    //     amount: data.amount,
    //     requisite: data.requisite,
    //     to: data.requisite,
    //   });

    //   this.logger.log(
    //     `Payout initiated successfully for transaction ${transaction.id}`,
    //   );
    //   return result;
    // } catch (error) {
    //   // Mark transaction as failed
    //   await this.transactionManager.failTransaction(
    //     transaction.id as number,
    //     error.message,
    //   );
    //   throw error;
    // }
  }
}
