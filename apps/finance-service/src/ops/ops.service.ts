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

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_DEPOSITS_CHANNEL_ID = '-1002939266999';

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

    const { status, transactionId, clientTransactionId, clientUserId, amount } =
      body;

    let numericAmount = Number(amount ?? 0);

    if (!clientTransactionId) {
      throw new Error('clientTransactionId is required');
    }

    const transaction = await this.transactionManager.getTransaction(
      Number(clientTransactionId),
      ['user'],
    );

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

      const failureMessage = this.buildFailureMessage(
        transaction.id as number,
        numericAmount,
      );

      await this.notifyUser(
        transaction.user.telegramId || null,
        failureMessage.text,
        failureMessage.keyboard,
      );

      await this.notifyChannel({
        text: this.buildChannelFailureMessage(
          transaction.id as number,
          numericAmount,
        ),
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

      const successMessage = this.buildSuccessMessage(
        transaction.id as number,
        numericAmount,
      );

      await this.notifyUser(
        transaction.user.telegramId || null,
        successMessage.text,
        successMessage.keyboard,
      );

      await this.notifyChannel(
        this.buildChannelSuccessMessage(
          transaction.user.telegramId || 'unknown',
          transaction.id as number,
          numericAmount,
        ),
      );

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

  private buildSuccessMessage(transactionId: number, amount: number) {
    const text = `✅ Ваш платеж <b>№${transactionId}</b> на сумму <b>${amount} RUB</b> был найден!

Средства начислены на ваш баланс!`;

    const keyboard = {
      inline_keyboard: [[{ text: '🎰 Играть!', callback_data: 'games' }]],
    };

    return { text, keyboard };
  }

  private buildFailureMessage(transactionId: number, amount: number) {
    const text = `❌ Ваш платеж <b>№${transactionId}</b> на сумму <b>${amount} RUB</b> не прошёл.

Если средства были списаны, обратитесь в поддержку.`;

    const keyboard = {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'start' }]],
    };

    return { text, keyboard };
  }

  private buildChannelSuccessMessage(
    userTelegramId: string,
    transactionId: number,
    amount: number,
  ) {
    const text = `✅ Депозит на сумму <b>${amount} RUB</b> оплачен!
👤 Юзер: <code>${userTelegramId}</code>
🏦 Метод: OPS`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🔍 К юзеру',
            url: `tg://user?id=${userTelegramId}`,
          },
        ],
      ],
    };

    return { text, keyboard };
  }

  private buildChannelFailureMessage(transactionId: number, amount: number) {
    return `❌ Ошибка пополнения
Платеж №${transactionId}
Сумма: ${amount} RUB`;
  }

  private async notifyUser(
    telegramId: string | null,
    message: string,
    keyboard?: any,
  ) {
    if (!telegramId) {
      return;
    }

    await this.sendTelegramMessage(telegramId, message, keyboard);
  }

  private async notifyChannel(message?: { text: string; keyboard?: any }) {
    const channelId =
      process.env.PAYMENTS_CHANNEL_ID || DEFAULT_DEPOSITS_CHANNEL_ID;

    if (!channelId || !message?.text) {
      return;
    }

    await this.sendTelegramMessage(channelId, message.text, message.keyboard);
  }

  private async sendTelegramMessage(
    chatId: string | number,
    text: string,
    keyboard?: any,
  ) {
    const token =
      process.env.PAYMENT_BOT_TOKEN || process.env.BOT_TOKEN || null;

    if (!token) {
      return;
    }

    try {
      await axios.post(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.log('Failed to send Telegram message:', error.message);
    }
  }
}
