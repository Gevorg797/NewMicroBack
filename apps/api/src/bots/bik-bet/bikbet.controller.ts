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
      await ctx.answerCbQuery();
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
    });

    // Dynamic deposit amount handler: deposit:<amount>
    this.bot.action(/deposit:(.+)/, async (ctx) => {
      const amount = Number((ctx as any).match?.[1]);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма');
        return;
      }
      await ctx.answerCbQuery();
      await this.bikbetService.depositAmount(ctx, amount);
    });

    // Game button click handler
    this.bot.action('games', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.game(ctx);
    });

    // Balances button click handler
    this.bot.action('donate_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.donateMenu(ctx);
    });

    // Top button click handler
    this.bot.action('leaderboard_wins', async (ctx) => {
      await this.bikbetService.leaderboardWins(ctx);
    });

    // Bounuses button click handler
    this.bot.action('bonuses', async (ctx) => {
      await this.bikbetService.bonuses(ctx);
    });

    // Profile button click handler
    this.bot.action('profile', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.profile(ctx);
    });

    // Info button click handler
    this.bot.action('info', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.info(ctx, channelLink);
    });

    // Wheel Info button click handler
    this.bot.action('wheelInfo', async (ctx) => {
      await this.bikbetService.wheelInfo(ctx);
    });

    // Promos Info button click handler
    this.bot.action('promosInfo', async (ctx) => {
      await this.bikbetService.promosInfo(ctx);
    });

    // Cashback Info button click handler
    this.bot.action('cashbackInfo', async (ctx) => {
      await this.bikbetService.cashbackInfo(ctx);
    });

    // VIP Club button click handler
    this.bot.action('vipClub', async (ctx) => {
      await this.bikbetService.vipClub(ctx);
    });

    // Leaderboard Winstreak button click handler
    this.bot.action('leaderboard_winstreak', async (ctx) => {
      await this.bikbetService.leaderboardWinstreak(ctx);
    });

    // Leaderboard Loosestrick button click handler
    this.bot.action('leaderboard_loosestrick', async (ctx) => {
      await this.bikbetService.leaderboardLoosestrick(ctx);
    });

    // Leaderboard Games button click handler
    this.bot.action('leaderboard_games', async (ctx) => {
      await this.bikbetService.leaderboardGames(ctx);
    });

    // Leaderboard Bets button click handler
    this.bot.action('leaderboard_bets', async (ctx) => {
      await this.bikbetService.leaderboardBets(ctx);
    });

    // Start button click handler
    this.bot.action('start', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.start(ctx, channelLink);
    });

    // Ignore button click handler
    this.bot.action('ignore_game', async (ctx) => {
      await ctx.answerCbQuery('⏳ В разработке');
    });

    // Ignore button click handler
    this.bot.action('ignore_all', async (ctx) => {
      await ctx.answerCbQuery('⏳ В разработке');
    });

    // Start game button click handler
    this.bot.action('slotsB2B', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.slotsB2B(ctx);
    });

    // Add balance button click handler
    this.bot.action('donate', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.donate(ctx);
    });

    // Withdraw button click handler
    this.bot.action('withdraw', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.withdraw(ctx);
    });

    // Desposit Custom button click handler
    this.bot.action('deposit:custom', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.depositCustom(ctx);
    });

    // (moved earlier) dynamic deposit handler above

    // Withdraw Custom button click handler
    this.bot.action('withdraw:custom', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.withdrawCustom(ctx);
    });

    //My Bounses button click handler
    this.bot.action('myBonuses', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.myBonuses(ctx);
    });

    this.bot.launch();
  }
}
