import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_DEPOSITS_CHANNEL_ID = '-1002939266999';

export interface DepositNotificationOptions {
  userTelegramId?: string | null;
  transactionId: number;
  amount: number;
  providerName: string;
}

export interface DepositFailureNotificationOptions
  extends DepositNotificationOptions {
  reason?: string;
}

export interface PayoutFailureNotificationOptions {
  userTelegramId?: string | null;
  transactionId?: number;
  amount: number;
  providerName?: string;
  methodId?: number;
  reason: string;
  technicalMessage?: string;
}

@Injectable()
export class PaymentNotificationService {
  private readonly logger = new Logger(PaymentNotificationService.name);

  private get botToken(): string | null {
    return process.env.PAYMENT_BOT_TOKEN || process.env.BOT_TOKEN || null;
  }

  private get channelId(): string | null {
    return (
      process.env.PAYMENTS_CHANNEL_ID || DEFAULT_DEPOSITS_CHANNEL_ID || null
    );
  }

  async notifyDepositSuccess(
    options: DepositNotificationOptions,
  ): Promise<void> {
    const { userTelegramId, transactionId, amount, providerName } = options;

    const userMessage = this.buildUserSuccessMessage(transactionId, amount);
    if (userTelegramId) {
      await this.sendTelegramMessage(
        userTelegramId,
        userMessage.text,
        userMessage.keyboard,
      );
    }

    const channelMessage = this.buildChannelSuccessMessage(
      userTelegramId,
      transactionId,
      amount,
      providerName,
    );

    if (channelMessage && this.channelId) {
      await this.sendTelegramMessage(
        this.channelId,
        channelMessage.text,
        channelMessage.keyboard,
      );
    }
  }

  async notifyDepositFailure(
    options: DepositFailureNotificationOptions,
  ): Promise<void> {
    const { userTelegramId, transactionId, amount, providerName, reason } =
      options;

    const userMessage = this.buildUserFailureMessage(
      transactionId,
      amount,
      providerName,
    );
    if (userTelegramId) {
      await this.sendTelegramMessage(
        userTelegramId,
        userMessage.text,
        userMessage.keyboard,
      );
    }

    const channelMessage = this.buildChannelFailureMessage(
      transactionId,
      amount,
      providerName,
      reason,
    );

    if (channelMessage && this.channelId) {
      await this.sendTelegramMessage(this.channelId, channelMessage);
    }
  }

  async notifyPayoutFailure(
    options: PayoutFailureNotificationOptions,
  ): Promise<void> {
    const {
      userTelegramId,
      transactionId,
      amount,
      providerName,
      methodId,
      reason,
      technicalMessage,
    } = options;

    const userMessage = this.buildUserPayoutFailureMessage(
      transactionId,
      amount,
      reason,
    );

    if (userTelegramId) {
      await this.sendTelegramMessage(
        userTelegramId,
        userMessage.text,
        userMessage.keyboard,
      );
    }

    const channelMessage = this.buildChannelPayoutFailureMessage(
      userTelegramId,
      transactionId,
      amount,
      providerName,
      methodId,
      technicalMessage || reason,
    );

    if (channelMessage && this.channelId) {
      await this.sendTelegramMessage(this.channelId, channelMessage);
    }
  }

  private buildUserSuccessMessage(transactionId: number, amount: number) {
    const text = `✅ Ваш платеж <b>№${transactionId}</b> на сумму <b>${amount} RUB</b> был найден!\n\nСредства начислены на ваш баланс!`;

    const keyboard = {
      inline_keyboard: [[{ text: '🎰 Играть!', callback_data: 'games' }]],
    };

    return { text, keyboard };
  }

  private buildUserFailureMessage(
    transactionId: number,
    amount: number,
    providerName: string,
  ) {
    const text = `❌ Ваш платеж <b>№${transactionId}</b> на сумму <b>${amount} RUB</b> в <b>${providerName}</b> не прошёл.\n\nЕсли средства были списаны, обратитесь в поддержку.`;

    const keyboard = {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'start' }]],
    };

    return { text, keyboard };
  }

  private buildChannelSuccessMessage(
    userTelegramId: string | null | undefined,
    transactionId: number,
    amount: number,
    providerName: string,
  ) {
    if (!userTelegramId) {
      return null;
    }

    const text = `✅ Депозит на сумму <b>${amount} RUB</b> оплачен!\n👤 Юзер: <code>${userTelegramId}</code>\n🏦 Метод: ${providerName}`;

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

  private buildChannelFailureMessage(
    transactionId: number,
    amount: number,
    providerName: string,
    reason?: string,
  ) {
    let text = `❌ Ошибка пополнения\nПлатеж №${transactionId}\nСумма: ${amount} RUB\nМетод: ${providerName}`;

    if (reason) {
      text += `\nПричина: ${reason}`;
    }

    return text;
  }

  private buildUserPayoutFailureMessage(
    transactionId: number | undefined,
    amount: number,
    reason: string,
  ) {
    const title = transactionId
      ? `❌ Ваш вывод <b>№${transactionId}</b>`
      : '❌ Ваш вывод';

    const text = `${title} на сумму <b>${amount} RUB</b> не выполнен.

Причина: ${reason}

Если вопрос не решён, обратитесь в поддержку.`;

    const keyboard = {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'start' }]],
    };

    return { text, keyboard };
  }

  private buildChannelPayoutFailureMessage(
    userTelegramId: string | null | undefined,
    transactionId: number | undefined,
    amount: number,
    providerName?: string,
    methodId?: number,
    reason?: string,
  ) {
    const lines = [
      '❌ Ошибка вывода',
      transactionId ? `ID запроса: ${transactionId}` : null,
      `Сумма: ${amount} RUB`,
      providerName ? `Метод: ${providerName}` : null,
      methodId ? `ID метода: ${methodId}` : null,
      userTelegramId ? `Юзер: ${userTelegramId}` : null,
      reason ? `Причина: ${reason}` : null,
    ].filter(Boolean);

    if (!lines.length) {
      return null;
    }

    return lines.join('\n');
  }

  private async sendTelegramMessage(
    chatId: string | number,
    text: string,
    keyboard?: any,
  ): Promise<void> {
    const token = this.botToken;

    if (!token) {
      this.logger.warn('Telegram bot token is not configured');
      return;
    }

    try {
      await axios.post(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to send Telegram message to ${chatId}: ${error.message}`,
      );
    }
  }
}
