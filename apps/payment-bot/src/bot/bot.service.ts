import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import axios from 'axios';
import { createHash, randomInt } from 'crypto';
import { Markup } from 'telegraf';
import { GptService } from './gpt.service';
import { BovaPaymentUser } from '@lib/database/entities/bova-payment-user.entity';
import {
  BovaPaymentMethod,
  BovaPaymentStatus,
  BovaPaymentTransaction,
} from '@lib/database/entities/bova-payment-transaction.entity';

interface ReplyOptions {
  parse_mode?: 'HTML';
  disable_web_page_preview?: boolean;
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly activeChatUsers = new Set<string>();
  private readonly initialBalance = Number(
    process.env.PAYMENT_BOT_INITIAL_BALANCE ?? 100,
  );
  private readonly chatCost = Number(process.env.PAYMENT_BOT_CHAT_COST ?? 2);
  private readonly minDeposit = Number(
    process.env.PAYMENT_BOT_MIN_DEPOSIT ?? 50,
  );
  private readonly yoomoneyWallet =
    process.env.PAYMENT_BOT_YOOMONEY_WALLET ?? '';
  private readonly yoomoneyToken = process.env.PAYMENT_BOT_YOOMONEY_TOKEN ?? '';
  private readonly yoomoneyApiUrl =
    process.env.PAYMENT_BOT_YOOMONEY_API_URL ??
    'https://yoomoney.ru/api/operation-history';
  private readonly apaysClientId = process.env.PAYMENT_BOT_APAYS_CLIENT_ID;
  private readonly apaysSecretKey = process.env.PAYMENT_BOT_APAYS_SECRET_KEY;
  private readonly apaysCreateUrl =
    process.env.PAYMENT_BOT_APAYS_CREATE_URL ??
    'https://apays.io/backend/create_order';
  private readonly apaysStatusUrl =
    process.env.PAYMENT_BOT_APAYS_STATUS_URL ??
    'https://apays.io/backend/get_order';
  private readonly shopName = process.env.PAYMENT_BOT_SHOP_NAME ?? 'GPT BOT';
  private readonly paymentLogChatId = Number(
    process.env.PAYMENT_BOT_LOG_CHAT_ID ?? 0,
  );
  private readonly paymentCheckRetries = Number(
    process.env.PAYMENT_BOT_PAYMENT_CHECK_RETRIES ?? 3,
  );
  private readonly paymentCheckDelayMs = Number(
    process.env.PAYMENT_BOT_PAYMENT_CHECK_DELAY_MS ?? 10000,
  );
  private readonly customDepositUsers = new Map<
    string,
    { messageId?: number }
  >();
  private readonly promoPendingUsers = new Set<string>();
  private readonly promoCode =
    process.env.PAYMENT_BOT_PROMOCODE ?? 'bovaAiOpen';
  private readonly promoReward = Number(
    process.env.PAYMENT_BOT_PROMOCODE_REWARD ?? 200,
  );

  constructor(
    private readonly em: EntityManager,
    private readonly gptService: GptService,
  ) {}

  async onModuleInit() {
    this.logger.log('Payment Bot Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Payment Bot Service destroyed');
  }

  getMemoryStats() {
    const memoryUsage = process.memoryUsage();
    return {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  async handleStart(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) {
      return;
    }
    const telegramId = this.getTelegramId(ctx);
    if (telegramId) {
      this.customDepositUsers.delete(telegramId);
      this.promoPendingUsers.delete(telegramId);
    }

    const firstName = ctx.from?.first_name ?? ctx.from?.username ?? 'друг';
    const message = `<b>👋 Привет, ${firstName}</b>

⚡ Я — ИИ, который способен ответить на все вопросы, найти любую информацию, помочь с домашкой, составить бизнес-план или проанализировать большой объем данных!

💎 Также у меня присутствует функция генерации изображений, советую посмотреть! Примеры можно увидеть внутри кнопки «Сгенерировать картинку»

<blockquote><b>👇 Используй клавиатуру ниже</b></blockquote>

🌟 Твой баланс: <b>${user.balance}</b>⭐`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💬 Начать чат 💬', 'start_chat')],
      [
        Markup.button.callback(
          '🖼️ Сгенерировать картинку 🖼️',
          'generate_image',
        ),
      ],
      [
        Markup.button.callback('💰 Баланс', 'donate'),
        Markup.button.callback('💼 Профиль', 'profile'),
      ],
    ]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup,
    });
  }

  async handleChatStart(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    const telegramId = this.getTelegramId(ctx);

    if (!user || !telegramId) {
      return;
    }

    this.customDepositUsers.delete(telegramId);
    this.promoPendingUsers.delete(telegramId);

    this.activeChatUsers.add(telegramId);
    this.gptService.resetConversation(telegramId);
    const promptsUrl =
      process.env.PAYMENT_BOT_PROMPTS_URL ??
      'https://telegra.ph/Specialnye-prompty-11-11';

    const message = `💬<b> Замечательно! Жду вашего сообщения:</b>

<i>Вы можете задать вопрос, попросить выполнить задачу, или, если хотите, мы можем просто поговорить ☺️</i>

Стоимость ответа: <b>${this.chatCost}</b>⭐

<blockquote>👀 Для особых задач:
<a href="${promptsUrl}">👉<b> Список промптов</b></a>
</blockquote>`;

    const options: ReplyOptions = {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, options);
        return;
      } catch {
        // ignore and fall back to sending a new message
      }
    }

    await ctx.reply(message, options);
  }

  async handleGenerateImage(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;

    await ctx.reply(
      '🖼️ Для генерации изображения отправь описание, например: "Создай футуристический город в неоне". Я пришлю результат в ответ.',
    );
  }

  async handleBalance(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;
    this.customDepositUsers.delete(user.telegramId);
    this.promoPendingUsers.delete(user.telegramId);

    const message = `<b>🌟 Покупка звезд</b>

<i>✨ Выберите количество звезд, которое хотите приобрести:</i>

<blockquote>⭐️ Курс звезд к рублю 1 к 1!</blockquote>`;

    await this.editOrReplyWithKeyboard(
      ctx,
      message,
      this.buildDonateKeyboard(),
    );
  }

  async handlePromocode(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;

    this.customDepositUsers.delete(user.telegramId);
    this.promoPendingUsers.add(user.telegramId);

    if (ctx.callbackQuery) {
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore deletion errors
      }
    }

    const message = `<b>🎟 Введите промокод</b>

<i>Отправьте промокод сообщением. Для отмены нажмите «❌ Отмена».</i>`;

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: this.buildPromocodeCancelKeyboard().reply_markup,
    });
  }

  async handlePromocodeMessage(ctx: any): Promise<boolean> {
    const telegramId = this.getTelegramId(ctx);
    if (!telegramId || !this.promoPendingUsers.has(telegramId)) {
      return false;
    }

    const text = ctx.message?.text?.trim();
    if (!text) {
      await ctx.reply('Введите текстовый промокод.');
      return true;
    }

    if (this.isCancelCommand(text)) {
      this.promoPendingUsers.delete(telegramId);
      await ctx.reply('❌ Ввод промокода отменен.', {
        reply_markup: Markup.removeKeyboard(),
      });
      await this.handleProfile(ctx);
      return true;
    }

    const user = await this.ensureUserExists(ctx);
    if (!user) {
      this.promoPendingUsers.delete(telegramId);
      return true;
    }

    if (user.promoActivated) {
      await ctx.reply('Вы уже активировали этот промокод!', {
        parse_mode: 'HTML',
        reply_markup: Markup.removeKeyboard(),
      });
      await this.handleProfile(ctx);
      return true;
    }

    if (text !== this.promoCode) {
      await ctx.reply('Такого промокода не существует!');
      return true;
    }

    const updated = await this.activatePromocode(telegramId, this.promoReward);
    if (!updated) {
      await ctx.reply(
        'Не удалось активировать промокод. Попробуйте позже или обратитесь в поддержку.',
      );
      return true;
    }

    this.promoPendingUsers.delete(telegramId);
    await ctx.reply(
      `✅ Промокод успешно активирован!\n⭐️ На ваш счет начислено ${this.promoReward} звезд.`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.removeKeyboard(),
      },
    );
    await this.handleProfile(ctx);
    return true;
  }

  async handleDepositCallback(ctx: any, rawValue: string): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;

    if (rawValue === 'custom') {
      await this.promptCustomDepositAmount(ctx, user.telegramId);
      return;
    }

    this.customDepositUsers.delete(user.telegramId);
    this.promoPendingUsers.delete(user.telegramId);

    const amount = Number(rawValue);

    if (!Number.isInteger(amount) || amount <= 0) {
      await ctx.answerCbQuery?.('Некорректная сумма', { show_alert: true });
      return;
    }

    await this.showDepositMethodSelection(ctx, amount);
  }

  async handleDepositMethod(
    ctx: any,
    method: 'yoomoney' | 'apays',
    amount: number,
  ): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;

    this.customDepositUsers.delete(user.telegramId);
    this.promoPendingUsers.delete(user.telegramId);

    if (!Number.isInteger(amount) || amount < this.minDeposit) {
      await ctx.answerCbQuery?.(
        `Минимальная сумма пополнения ${this.minDeposit} RUB`,
        { show_alert: true },
      );
      return;
    }

    if (method === 'yoomoney') {
      await this.handleYoomoneyDeposit(ctx, user, amount);
      return;
    }

    if (method === 'apays') {
      await this.handleApaysDeposit(ctx, user, amount);
      return;
    }

    await ctx.answerCbQuery?.('Метод оплаты недоступен', {
      show_alert: true,
    });
  }

  async handleDepositText(ctx: any): Promise<boolean> {
    const telegramId = this.getTelegramId(ctx);
    if (!telegramId) {
      return false;
    }

    if (!this.customDepositUsers.has(telegramId)) {
      return false;
    }

    const text = ctx.message?.text?.trim();

    if (!text) {
      return false;
    }

    const amount = Number(text);

    if (!Number.isInteger(amount)) {
      await ctx.reply(
        `<i>❌ Введите корректное количество (целое число):</i>`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    if (amount < this.minDeposit) {
      await ctx.reply(
        `<i>Минимальная сумма пополнения: ${this.minDeposit} RUB</i>`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    this.customDepositUsers.delete(telegramId);
    await this.showDepositMethodSelection(ctx, amount, false);
    return true;
  }

  async handleApaysStatusCheck(ctx: any, invoiceId: string): Promise<void> {
    const payment = await this.getPaymentByInvoiceId(invoiceId);
    if (!payment) {
      await ctx.answerCbQuery?.('Платеж не найден');
      return;
    }

    if (payment.method !== BovaPaymentMethod.APAYS) {
      await ctx.answerCbQuery?.('Неверный тип платежа', { show_alert: true });
      return;
    }

    const status = await this.fetchApaysStatus(invoiceId);

    if (!status) {
      await ctx.answerCbQuery?.('Не удалось получить статус платежа', {
        show_alert: true,
      });
      return;
    }

    if (status === 'pending') {
      await ctx.answerCbQuery?.('⏳ Ожидается оплата...');
      return;
    }

    if (status === 'decline') {
      await this.updatePaymentStatus(invoiceId, BovaPaymentStatus.DECLINE);
      await ctx.answerCbQuery?.('❌ Оплата отклонена', { show_alert: true });
      await this.handleBalance(ctx);
      return;
    }

    if (status === 'expired') {
      await this.updatePaymentStatus(invoiceId, BovaPaymentStatus.EXPIRED);
      await ctx.answerCbQuery?.('⏳ Время оплаты истекло', {
        show_alert: true,
      });
      await this.handleBalance(ctx);
      return;
    }

    if (status === 'approve') {
      const result = await this.finalizePaymentSuccess(payment, payment.amount);

      if (!result) {
        await ctx.answerCbQuery?.('Не удалось завершить платеж', {
          show_alert: true,
        });
        return;
      }

      await this.editOrReplyWithKeyboard(
        ctx,
        `✅ Оплата успешно найдена!\n\nВаш баланс пополнен.\n💰 Текущий баланс: <b>${result.balance}</b>⭐`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'start')]]),
      );

      await this.notifyPaymentLog(
        ctx,
        `✅ Оплата успешно прошла!\n\nЮзер: ${payment.user.telegramId}\nСумма: ${payment.amount} RUB\nБаланс: ${result.balance}⭐`,
      );
      return;
    }

    await ctx.answerCbQuery?.('Неизвестный статус платежа', {
      show_alert: true,
    });
  }

  async handleYoomoneyStatusCheck(ctx: any, label: string): Promise<void> {
    const payment = await this.getPaymentByInvoiceId(label);
    if (!payment) {
      await ctx.answerCbQuery?.('Платеж не найден', { show_alert: true });
      return;
    }

    if (!this.yoomoneyToken) {
      await ctx.answerCbQuery?.('Проверка платежа недоступна', {
        show_alert: true,
      });
      return;
    }

    const params = new URLSearchParams({
      label,
      records: '30',
    });

    try {
      const response = await axios.post(this.yoomoneyApiUrl, params, {
        headers: {
          Authorization: `Bearer ${this.yoomoneyToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const operations = response.data?.operations ?? [];

      const successOperation = operations.find(
        (operation: any) => operation.status === 'success',
      );

      if (!successOperation) {
        await ctx.answerCbQuery?.('Платеж пока не найден', {
          show_alert: false,
        });
        return;
      }

      const amount = Number(successOperation.amount);

      const result = await this.finalizePaymentSuccess(payment, amount);

      if (!result) {
        await ctx.answerCbQuery?.('Не удалось завершить платеж', {
          show_alert: true,
        });
        return;
      }

      await this.editOrReplyWithKeyboard(
        ctx,
        `✅ Оплата на сумму <b>${amount} RUB</b> успешно найдена!\n\nВаш баланс пополнен.\n💰 Текущий баланс: <b>${result.balance}</b>⭐`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'start')]]),
      );

      await this.notifyPaymentLog(
        ctx,
        `✅ Оплата на сумму <b>${amount} RUB</b> успешно прошла!\n\nЮзер: ${payment.user.telegramId}\nБаланс: ${result.balance}⭐`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при проверке платежа YooMoney: ${(error as Error).message}`,
        (error as Error).stack,
      );
      await ctx.reply(
        'Произошла ошибка при проверке платежа. Пожалуйста, свяжитесь с поддержкой.',
      );
    }
  }

  async handleUserMessage(ctx: any): Promise<void> {
    const telegramId = this.getTelegramId(ctx);

    if (!telegramId || !this.activeChatUsers.has(telegramId)) {
      return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) {
      return;
    }

    const user = await this.ensureUserExists(ctx);
    if (!user) return;

    if (user.balance < this.chatCost) {
      await ctx.reply(
        `😢 Недостаточно звезд. Стоимость ответа — ${this.chatCost}⭐. Попробуй пополнить баланс.`,
      );
      return;
    }

    const debitedUser = await this.adjustBalance(telegramId, -this.chatCost);
    if (!debitedUser) {
      await ctx.reply(
        '😢 Сейчас не удалось списать звезды. Попробуй позже или обратись в поддержку.',
      );
      return;
    }

    try {
      await ctx.sendChatAction('typing');
    } catch (error) {
      this.logger.debug(
        `Failed to send typing action for ${telegramId}: ${(error as Error).message}`,
      );
    }

    try {
      const reply = await this.gptService.generateChatResponse(
        telegramId,
        text,
      );
      await this.replyInChunks(ctx, reply);
      await ctx.reply(`💫 Остаток: <b>${debitedUser.balance}</b>⭐`, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate GPT response for ${telegramId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      await this.adjustBalance(telegramId, this.chatCost);
      await ctx.reply(
        '❌ Не удалось получить ответ от ИИ. Попробуй повторить позже. Звезды возвращены на баланс.',
      );
    }
  }

  async handleProfile(ctx: any): Promise<void> {
    const user = await this.ensureUserExists(ctx);
    if (!user) return;
    this.customDepositUsers.delete(user.telegramId);
    this.promoPendingUsers.delete(user.telegramId);

    const createdAt = this.formatMoscowDate(user.createdAt);
    const promoStatus = user.promoActivated
      ? '✅ Активирован'
      : '❌ Не активирован';

    const response = `⚙️ <b>Ваш профиль</b>

🆔 ID: <code>${user.telegramId}</code>
🌟 Баланс: <b>${user.balance}</b>⭐
🎟 Промокод: ${promoStatus}
📅 Дата регистрации (МСК):
┗ ${createdAt}`;

    await this.editOrReplyWithKeyboard(
      ctx,
      response,
      this.buildProfileKeyboard(),
    );
  }

  private async ensureUserExists(ctx: any): Promise<BovaPaymentUser | null> {
    const telegramId = this.getTelegramId(ctx);

    if (!telegramId) {
      this.logger.warn('Unable to determine telegramId from context');
      return null;
    }

    const username = ctx.from?.username ?? undefined;
    const firstName = ctx.from?.first_name ?? undefined;
    const lastName = ctx.from?.last_name ?? undefined;

    try {
      const user = await this.em.transactional<BovaPaymentUser | null>(
        async (em) => {
          let existing = await em.findOne(
            BovaPaymentUser,
            { telegramId },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );

          if (!existing) {
            existing = em.create(BovaPaymentUser, {
              telegramId,
              username,
              firstName,
              lastName,
              balance: this.initialBalance,
              promoActivated: false,
              createdAt: new Date(),
            });
            em.persist(existing);
          } else {
            let updated = false;
            if (username && existing.username !== username) {
              existing.username = username;
              updated = true;
            }
            if (firstName && existing.firstName !== firstName) {
              existing.firstName = firstName;
              updated = true;
            }
            if (lastName && existing.lastName !== lastName) {
              existing.lastName = lastName;
              updated = true;
            }
            if (updated) {
              existing.updatedAt = new Date();
            }
          }

          await em.flush();
          return existing;
        },
      );

      return user;
    } catch (error) {
      this.logger.error(
        `Failed to ensure user ${telegramId} exists: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private async adjustBalance(
    telegramId: string,
    delta: number,
  ): Promise<BovaPaymentUser | null> {
    try {
      return await this.em.transactional<BovaPaymentUser | null>(async (em) => {
        const user = await em.findOne(
          BovaPaymentUser,
          { telegramId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!user) {
          return null;
        }

        const newBalance = user.balance + delta;
        if (newBalance < 0) {
          return null;
        }

        user.balance = newBalance;
        user.updatedAt = new Date();
        await em.flush();
        return user;
      });
    } catch (error) {
      this.logger.error(
        `Failed to adjust balance for ${telegramId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private getTelegramId(ctx: any): string | null {
    return ctx.from?.id ? String(ctx.from.id) : null;
  }

  private async replyInChunks(ctx: any, text: string): Promise<void> {
    const chunkSize = 3500;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      // eslint-disable-next-line no-await-in-loop
      await ctx.reply(chunk);
    }
  }

  private formatMoscowDate(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private async promptCustomDepositAmount(
    ctx: any,
    telegramId: string,
  ): Promise<void> {
    this.customDepositUsers.set(telegramId, {
      messageId: ctx.callbackQuery?.message?.message_id,
    });
    this.promoPendingUsers.delete(telegramId);

    const message = `<i>💰 Введите сумму звезд для покупки</i>\n<i>✨ Минимальное количество звезд: ${this.minDeposit} шт</i>\n<i>⭐️ Отправьте нужное количество сообщением</i>`;

    await this.editOrReplyWithKeyboard(
      ctx,
      message,
      this.buildDepositAmountBackKeyboard(),
    );
  }

  private async showDepositMethodSelection(
    ctx: any,
    amount: number,
    allowEdit = true,
  ): Promise<void> {
    const message = `<i>💰 Выберите способ оплаты</i>\n<i>💎 Сумма: <code>${amount} RUB</code></i>\n<i>⚡️ Укажите способ оплаты</i>`;
    const keyboard = this.buildDepositMethodKeyboard(amount);

    if (allowEdit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
        return;
      } catch {
        // fallthrough to reply
      }
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup,
    });
  }

  private buildDepositMethodKeyboard(amount: number) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('От 50р:', 'ignore_game')],
      [Markup.button.callback('Карта', `deposit_apays_${amount}`)],
      [Markup.button.callback('Юмани', `deposit_yoomoney_${amount}`)],
      [Markup.button.callback('⬅️ Назад', 'donate')],
    ]);
  }

  private buildDepositAmountBackKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Назад', 'donate')],
    ]);
  }

  private buildPromocodeCancelKeyboard() {
    return Markup.keyboard([['❌ Отмена']])
      .oneTime()
      .resize();
  }

  private async handleYoomoneyDeposit(
    ctx: any,
    user: BovaPaymentUser,
    amount: number,
  ): Promise<void> {
    const invoiceId = `${user.telegramId}_${Math.floor(Date.now() / 1000)}`;

    await this.recordPendingPayment(
      user,
      invoiceId,
      amount,
      BovaPaymentMethod.YOOMONEY,
    );

    const params = new URLSearchParams({
      receiver: this.yoomoneyWallet,
      'quickpay-form': 'shop',
      targets: `Пополнение баланса в ${this.shopName} (user_id: ${user.telegramId})`,
      paymentType: 'PC',
      sum: amount.toString(),
      label: invoiceId,
    });

    const paymentUrl = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;

    const message = `💰 Вы собираетесь пополнить баланс на: <b>${amount} RUB</b>\n\nНажмите на кнопку ниже, чтобы перейти на страницу оплаты. После успешной оплаты вернитесь в бот и нажмите «Я оплатил(а)».\n\n<i>(Платеж будет привязан к метке: <code>${invoiceId}</code>)</i>`;

    await this.editOrReplyWithKeyboard(
      ctx,
      message,
      Markup.inlineKeyboard([
        [Markup.button.url('➡️ Перейти к оплате', paymentUrl)],
        [Markup.button.callback('✅ Я оплатил(а)', `check_${invoiceId}`)],
      ]),
    );
  }

  private async handleApaysDeposit(
    ctx: any,
    user: BovaPaymentUser,
    amount: number,
  ): Promise<void> {
    // if (!this.apaysClientId || !this.apaysSecretKey) {
    //   await ctx.answerCbQuery?.('Метод оплаты временно недоступен', {
    //     show_alert: true,
    //   });
    //   return;
    // }

    const invoiceId = `${Date.now()}${randomInt(1000, 9999)}`;
    const amountInKopecks = amount * 100;
    const signString = `${invoiceId}:${amountInKopecks}:${this.apaysSecretKey}`;
    const sign = this.createMd5Signature(signString);

    try {
      const response = await axios.get(this.apaysCreateUrl, {
        params: {
          client_id: this.apaysClientId,
          order_id: invoiceId,
          amount: amountInKopecks,
          sign,
        },
      });

      const data = response.data;

      if (!data?.status) {
        const errorMessage =
          data?.message ?? 'Произошла неизвестная ошибка при создании платежа';
        await ctx.answerCbQuery?.(errorMessage, { show_alert: true });
        return;
      }

      const paymentUrl = data.url;

      await this.recordPendingPayment(
        user,
        invoiceId,
        amount,
        BovaPaymentMethod.APAYS,
      );

      await this.editOrReplyWithKeyboard(
        ctx,
        '🔗 Ваша ссылка на оплату:',
        Markup.inlineKeyboard([
          [Markup.button.url('🔗 Оплатить', paymentUrl)],
          [Markup.button.callback('🔄 Проверить', `loot@${invoiceId}`)],
          [Markup.button.callback('⬅️ Назад', 'donate')],
        ]),
      );
    } catch (error) {
      let userMessage = 'Не удалось создать платеж. Попробуйте позже.';
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        const details =
          (typeof data === 'object' && data?.message) ||
          (typeof data === 'string' ? data : null);
        if (details) {
          userMessage = `Не удалось создать платеж: ${details}`;
        } else if (status) {
          userMessage = `Не удалось создать платеж (код ${status}).`;
        }
        this.logger.error(
          `Не удалось создать платеж Apay: status=${status}, data=${JSON.stringify(
            data,
          )}`,
        );
      } else {
        this.logger.error(
          `Не удалось создать платеж Apay: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
      await ctx.answerCbQuery?.(userMessage, {
        show_alert: true,
      });
    }
  }

  private async fetchApaysStatus(invoiceId: string): Promise<string | null> {
    if (!this.apaysClientId || !this.apaysSecretKey) {
      return null;
    }

    const sign = this.createMd5Signature(`${invoiceId}:${this.apaysSecretKey}`);

    try {
      const response = await axios.get(this.apaysStatusUrl, {
        params: {
          client_id: this.apaysClientId,
          order_id: invoiceId,
          sign,
        },
      });

      const data = response.data;

      if (!data?.status) {
        return null;
      }

      return data.order_status;
    } catch (error) {
      this.logger.error(
        `Не удалось получить статус платежа Apay: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private async getPaymentByInvoiceId(invoiceId: string) {
    return this.em.findOne(
      BovaPaymentTransaction,
      { invoiceId },
      { populate: ['user'] },
    );
  }

  private async recordPendingPayment(
    user: BovaPaymentUser,
    invoiceId: string,
    amount: number,
    method: BovaPaymentMethod,
  ): Promise<void> {
    await this.em.transactional(async (em) => {
      let payment = await em.findOne(
        BovaPaymentTransaction,
        { invoiceId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (!payment) {
        payment = em.create(BovaPaymentTransaction, {
          user,
          invoiceId,
          amount,
          method,
          status: BovaPaymentStatus.WAITING,
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          createdAt: new Date(),
        });
        em.persist(payment);
      } else {
        payment.amount = amount;
        payment.method = method;
        payment.status = BovaPaymentStatus.WAITING;
        payment.balanceBefore = user.balance;
        payment.balanceAfter = user.balance;
      }

      await em.flush();
    });
  }

  private async finalizePaymentSuccess(
    payment: BovaPaymentTransaction,
    amount: number,
  ): Promise<{ balance: number } | null> {
    return this.em.transactional(async (em) => {
      const paymentEntity = await em.findOne(
        BovaPaymentTransaction,
        { invoiceId: payment.invoiceId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['user'] },
      );

      if (!paymentEntity) {
        return null;
      }

      const user = await em.findOne(
        BovaPaymentUser,
        { id: paymentEntity.user.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (!user) {
        return null;
      }

      if (paymentEntity.status === BovaPaymentStatus.SUCCESS) {
        return { balance: user.balance };
      }

      const balanceBefore = user.balance;
      user.balance += amount;
      user.updatedAt = new Date();

      paymentEntity.amount = amount;
      paymentEntity.status = BovaPaymentStatus.SUCCESS;
      paymentEntity.balanceBefore = balanceBefore;
      paymentEntity.balanceAfter = user.balance;
      paymentEntity.updatedAt = new Date();

      await em.flush();

      return { balance: user.balance };
    });
  }

  private async activatePromocode(
    telegramId: string,
    reward: number,
  ): Promise<BovaPaymentUser | null> {
    try {
      return await this.em.transactional(async (em) => {
        const user = await em.findOne(
          BovaPaymentUser,
          { telegramId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!user || user.promoActivated) {
          return null;
        }

        user.balance += reward;
        user.promoActivated = true;
        user.updatedAt = new Date();
        await em.flush();
        return user;
      });
    } catch (error) {
      this.logger.error(
        `Не удалось активировать промокод для ${telegramId}: ${
          (error as Error).message
        }`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private async updatePaymentStatus(
    invoiceId: string,
    status: BovaPaymentStatus,
  ): Promise<void> {
    await this.em.nativeUpdate(
      BovaPaymentTransaction,
      { invoiceId },
      { status, updatedAt: new Date() },
    );
  }

  private createMd5Signature(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  private async notifyPaymentLog(ctx: any, message: string): Promise<void> {
    if (!this.paymentLogChatId) {
      return;
    }

    try {
      await ctx.telegram.sendMessage(this.paymentLogChatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось отправить лог оплаты: ${(error as Error).message}`,
      );
    }
  }

  private isCancelCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return (
      normalized === '❌ отмена'.toLowerCase() ||
      normalized === 'отмена' ||
      normalized === 'cancel' ||
      normalized === '/cancel'
    );
  }

  private buildDonateKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('100 RUB', 'deposit:100'),
        Markup.button.callback('250 RUB', 'deposit:250'),
      ],
      [
        Markup.button.callback('500 RUB', 'deposit:500'),
        Markup.button.callback('1000 RUB', 'deposit:1000'),
      ],
      [
        Markup.button.callback('2500 RUB', 'deposit:2500'),
        Markup.button.callback('5000 RUB', 'deposit:5000'),
      ],
      [Markup.button.callback('💰 Своя сумма', 'deposit:custom')],
      [Markup.button.callback('⬅️ Назад', 'start')],
    ]);
  }

  private buildProfileKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('💰 Пополнить баланс', 'donate')],
      [Markup.button.callback('🎟 Промокод', 'promocode')],
      [
        Markup.button.url(
          '📄 Политика конфиденциальности',
          process.env.PAYMENT_BOT_PRIVACY_URL ??
            'https://telegra.ph/POLITIKA-KONFIDENCIALNOSTI-PO-RABOTE-S-PERSONALNYMI-DANNYMI-POLZOVATELEJ-11-11-2',
        ),
      ],
      [
        Markup.button.url(
          '📃 Пользовательское соглашение',
          process.env.PAYMENT_BOT_TOS_URL ??
            'https://telegra.ph/Polzovatelskoe-soglashenie-Publichnaya-oferta-11-11-2',
        ),
      ],
      [Markup.button.callback('◀️ Вернуться назад', 'start')],
    ]);
  }

  private async editOrReplyWithKeyboard(
    ctx: any,
    message: string,
    keyboard: ReturnType<typeof Markup.inlineKeyboard>,
  ) {
    const options = {
      parse_mode: 'HTML' as const,
      reply_markup: keyboard.reply_markup,
    };

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, options);
        return;
      } catch {
        // Fallback to sending a new message.
      }
    }

    await ctx.reply(message, options);
  }
}
