import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BotService } from './bot.service';
import { Telegraf } from 'telegraf';
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
      await ctx.answerCbQuery();
      await this.botService.handleChatStart(ctx);
    });

    this.bot.action('generate_image', async (ctx) => {
      await ctx.answerCbQuery();
      await this.botService.handleGenerateImage(ctx);
    });

    this.bot.action('donate', async (ctx) => {
      await ctx.answerCbQuery();
      await this.botService.handleBalance(ctx);
    });

    this.bot.action(/deposit:(.+)/, async (ctx) => {
      const match = (ctx as any).match?.[1];
      await ctx.answerCbQuery();
      if (!match) {
        await ctx.answerCbQuery('Некорректные данные', { show_alert: true });
        return;
      }
      await this.botService.handleDepositCallback(ctx, match);
    });

    this.bot.action(/deposit_(yoomoney|apays)_(\d+)/, async (ctx) => {
      const method = (ctx as any).match?.[1];
      const amountRaw = (ctx as any).match?.[2];
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery();
      await this.botService.handleDepositMethod(
        ctx,
        method as 'yoomoney' | 'apays',
        amount,
      );
    });

    this.bot.action(/loot@(.+)/, async (ctx) => {
      const invoiceId = (ctx as any).match?.[1];
      if (!invoiceId) {
        await ctx.answerCbQuery('Некорректная ссылка', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery();
      await this.botService.handleApaysStatusCheck(ctx, invoiceId);
    });

    this.bot.action(/check_(.+)/, async (ctx) => {
      const label = (ctx as any).match?.[1];
      if (!label) {
        await ctx.answerCbQuery('Некорректная метка', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery();
      await this.botService.handleYoomoneyStatusCheck(ctx, label);
    });

    this.bot.action('profile', async (ctx) => {
      await ctx.answerCbQuery();
      await this.botService.handleProfile(ctx);
    });

    this.bot.on('text', async (ctx) => {
      if (ctx.message?.text?.startsWith('/')) {
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
}
