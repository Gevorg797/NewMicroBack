import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  FinanceTransactions,
  Balances,
  BalanceType,
  User,
  Currency,
} from '@lib/database';
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';
import {
  TransactionNotFoundException,
  BalanceNotFoundException,
  InsufficientBalanceException,
  TransactionAlreadyProcessedException,
} from '../exceptions/finance-service.exceptions';

@Injectable()
export class TransactionManagerService {
  private readonly logger = new Logger(TransactionManagerService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Get transaction with populated relations
   */
  async getTransaction(
    transactionId: number,
    populate: string[] = [],
  ): Promise<FinanceTransactions> {
    this.logger.debug(
      `Getting transaction ${transactionId} with populate: ${populate.join(', ')}`,
    );

    const transaction = await this.em.findOne(
      FinanceTransactions,
      { id: transactionId },
      { populate: populate as any },
    );

    if (!transaction) {
      throw new TransactionNotFoundException(transactionId);
    }

    return transaction;
  }

  /**
   * Get main balance for a user
   */
  async getMainBalance(user: User): Promise<Balances> {
    this.logger.debug(`Getting main balance for user ${user.id}`);

    const balance = await this.em.findOne(
      Balances,
      { user, type: BalanceType.MAIN },
      { populate: ['currency'] },
    );

    if (!balance) {
      throw new BalanceNotFoundException(user.id!);
    }

    return balance;
  }

  /**
   * Check if user has sufficient balance
   */
  async checkSufficientBalance(user: User, amount: number): Promise<Balances> {
    const balance = await this.getMainBalance(user);

    if (balance.balance < amount) {
      throw new InsufficientBalanceException(amount, balance.balance);
    }

    return balance;
  }

  /**
   * Credit amount to user's main balance
   */
  async creditBalance(
    user: User,
    amount: number,
    transaction: FinanceTransactions,
  ): Promise<void> {
    this.logger.debug(`Crediting ${amount} to user ${user.id}`);

    const mainBalance = await this.getMainBalance(user);
    mainBalance.balance += amount;

    await this.em.persistAndFlush([transaction, mainBalance]);

    this.logger.log(
      `Credited ${amount} to user ${user.id}. New balance: ${mainBalance.balance}`,
    );
  }

  /**
   * Debit amount from user's main balance
   */
  async debitBalance(
    user: User,
    amount: number,
    transaction: FinanceTransactions,
  ): Promise<void> {
    this.logger.debug(`Debiting ${amount} from user ${user.id}`);

    const mainBalance = await this.checkSufficientBalance(user, amount);
    mainBalance.balance -= amount;

    await this.em.persistAndFlush([transaction, mainBalance]);

    this.logger.log(
      `Debited ${amount} from user ${user.id}. New balance: ${mainBalance.balance}`,
    );
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transaction: FinanceTransactions,
    status: PaymentTransactionStatus,
    paymentTransactionId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Updating transaction ${transaction.id} status to ${status}`,
    );

    transaction.status = status;
    if (paymentTransactionId) {
      transaction.paymentTransactionId = paymentTransactionId;
    }

    await this.em.persistAndFlush(transaction);
  }

  /**
   * Validate transaction is not already processed
   */
  validateTransactionNotProcessed(transaction: FinanceTransactions): void {
    if (
      transaction.status === PaymentTransactionStatus.COMPLETED ||
      transaction.status === PaymentTransactionStatus.FAILED
    ) {
      throw new TransactionAlreadyProcessedException(
        transaction.id as number,
        transaction.status,
      );
    }
  }

  /**
   * Complete payin (deposit) transaction
   */
  async completePayin(
    transactionId: number,
    amount: number,
    paymentTransactionId: string,
  ): Promise<void> {
    this.logger.log(`Completing payin transaction ${transactionId}`);

    const transaction = await this.getTransaction(transactionId, ['user']);

    this.validateTransactionNotProcessed(transaction);

    if (transaction.amount !== amount) {
      throw new Error(
        `Amount mismatch. Expected: ${transaction.amount}, Received: ${amount}`,
      );
    }

    await this.creditBalance(transaction.user, amount, transaction);
    await this.updateTransactionStatus(
      transaction,
      PaymentTransactionStatus.COMPLETED,
      paymentTransactionId,
    );

    this.logger.log(
      `Payin transaction ${transactionId} completed successfully`,
    );
  }

  /**
   * Complete payout (withdrawal) transaction
   */
  async completePayout(
    transactionId: number,
    paymentTransactionId: string,
  ): Promise<void> {
    this.logger.log(`Completing payout transaction ${transactionId}`);

    const transaction = await this.getTransaction(transactionId, ['user']);

    await this.updateTransactionStatus(
      transaction,
      PaymentTransactionStatus.COMPLETED,
      paymentTransactionId,
    );

    this.logger.log(
      `Payout transaction ${transactionId} completed successfully`,
    );
  }

  /**
   * Fail transaction
   */
  async failTransaction(transactionId: number, reason?: string): Promise<void> {
    this.logger.warn(
      `Failing transaction ${transactionId}: ${reason || 'Unknown reason'}`,
    );

    const transaction = await this.getTransaction(transactionId);
    await this.updateTransactionStatus(
      transaction,
      PaymentTransactionStatus.FAILED,
    );
  }
}
