import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BikBetService } from './bikbet.service';
import { Telegraf } from 'telegraf';

@ApiTags('clients')
@Controller('clients')
export class BikBetController {
  private bot: Telegraf;
  constructor(private readonly bikbetService: BikBetService) {
    this.bot = new Telegraf(process.env.BOT_TOKEN as string);
  }

  onModuleInit() {
    const channelId = '-1002953826717'; // replace with your channel
    const channelLink = 'https://t.me/+Q1wQJIeOz7YyYzAy'; // your channel link

    // /start handler
    this.bot.start(async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
    });

    // Button click handler
    this.bot.action('check_subscription', async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Game button click handler
    this.bot.action('games', async (ctx) => {
      await this.bikbetService.game(ctx);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Balances button click handler
    this.bot.action('donate_menu', async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Top button click handler
    this.bot.action('leaderboard_wins', async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Bounuses button click handler
    this.bot.action('bonuses', async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Start button click handler
    this.bot.action('start', async (ctx) => {
      await this.bikbetService.start(ctx, channelLink);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Ignore button click handler
    this.bot.action('ignore_game', async (ctx) => {
      await ctx.answerCbQuery();
    });

    // Ignore button click handler
    this.bot.action('ignore_all', async (ctx) => {
      await ctx.answerCbQuery();
    });

    // Start game button click handler
    this.bot.action('slotsB2B', async (ctx) => {
      await this.bikbetService.slotsB2B(ctx);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Add balance button click handler
    this.bot.action('donate', async (ctx) => {
      await this.bikbetService.donate(ctx);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    // Desposit Custom button click handler
    this.bot.action('deposit:custom', async (ctx) => {
      await this.bikbetService.depositCustom(ctx);
      await ctx.answerCbQuery(); // remove "loading" animation
    });

    this.bot.launch();
  }
}
