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
            await ctx.reply('Welcome to Payment Bot! 🎰');
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

