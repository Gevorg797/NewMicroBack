import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BotService } from './bot.service';
import { Telegraf, TelegramError } from 'telegraf';
import { checkIsTelegramAdmin } from 'libs/utils/decorator/telegram-admin.decorator';

@ApiTags('payment-bot')
@Controller('payment-bot')
export class BotController {
  private bot: Telegraf;
  constructor(private readonly botService: BotService) {
    this.bot = new Telegraf(process.env.PAYMENT_BOT_TOKEN as string);
  }

  /**
   * Get memory statistics for monitoring
   */
  @Get('memory-stats')
  getMemoryStats() {
    return this.botService.getMemoryStats();
  }

  onModuleInit() {
    // /start handler
    this.bot.start(async (ctx) => {
      await this.botService.handleStart(ctx);
    });

    this.bot.action('start_chat', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleChatStart(ctx);
    });

    this.bot.action('generate_image', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleGenerateImage(ctx);
    });

    this.bot.action('donate', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleBalance(ctx);
    });

    this.bot.action('promocode', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handlePromocode(ctx);
    });

    this.bot.action('start', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleStart(ctx);
    });

    this.bot.action(/deposit:(.+)/, async (ctx) => {
      const match = (ctx as any).match?.[1];
      await this.safeAnswerCbQuery(ctx);
      if (!match) {
        await this.safeAnswerCbQuery(ctx, 'Некорректные данные', {
          show_alert: true,
        });
        return;
      }
      await this.botService.handleDepositCallback(ctx, match);
    });

    this.bot.action(/deposit_yoomoney_(\d+)/, async (ctx) => {
      const amountRaw = (ctx as any).match?.[1];
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        await this.safeAnswerCbQuery(ctx, 'Некорректная сумма', {
          show_alert: true,
        });
        return;
      }
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleDepositMethod(ctx, 'yoomoney', amount);
    });

    this.bot.action(/deposit_apays_(\d+)/, async (ctx) => {
      const amountRaw = (ctx as any).match?.[1];
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        await this.safeAnswerCbQuery(ctx, 'Некорректная сумма', {
          show_alert: true,
        });
        return;
      }
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleDepositMethod(ctx, 'apays', amount);
    });

    this.bot.action(/loot@(.+)/, async (ctx) => {
      const invoiceId = (ctx as any).match?.[1];
      if (!invoiceId) {
        await this.safeAnswerCbQuery(ctx, 'Некорректная ссылка', {
          show_alert: true,
        });
        return;
      }
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleApaysStatusCheck(ctx, invoiceId);
    });

    this.bot.action(/check_(.+)/, async (ctx) => {
      const label = (ctx as any).match?.[1];
      if (!label) {
        await this.safeAnswerCbQuery(ctx, 'Некорректная метка', {
          show_alert: true,
        });
        return;
      }
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleYoomoneyStatusCheck(ctx, label);
    });

    this.bot.action('profile', async (ctx) => {
      await this.safeAnswerCbQuery(ctx);
      await this.botService.handleProfile(ctx);
    });

    this.bot.on('text', async (ctx) => {
      if (ctx.message?.text?.startsWith('/')) {
        return;
      }
      if (await this.botService.handlePromocodeMessage(ctx)) {
        return;
      }
      if (await this.botService.handleDepositText(ctx)) {
        return;
      }
      await this.botService.handleUserMessage(ctx);
    });

    // /admin handler - Show admin menu
    this.bot.command('admin', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.reply('Admin menu - Payment Bot');
    });

    // Launch bot
    this.bot.launch().then(() => {
      console.log('Payment Bot started successfully');
    });

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  onModuleDestroy() {
    this.bot.stop();
  }

  private async safeAnswerCbQuery(
    ctx: any,
    text?: string,
    extra?: { show_alert?: boolean; url?: string; cache_time?: number },
  ) {
    if (typeof ctx.answerCbQuery !== 'function') {
      return;
    }

    try {
      await ctx.answerCbQuery(text, extra);
    } catch (error) {
      if (
        error instanceof TelegramError &&
        error.response?.error_code === 400 &&
        error.response?.description?.includes('query is too old')
      ) {
        return;
      }

      throw error;
    }
  }
}
