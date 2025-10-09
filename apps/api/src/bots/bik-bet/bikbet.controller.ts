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

    // Dynamic withdraw amount handler: withdraw:<amount>
    this.bot.action(/withdraw:(.+)/, async (ctx) => {
      const match = (ctx as any).match?.[1];

      // Handle custom withdraw
      if (match === 'custom') {
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawCustom(ctx);
        return;
      }

      // Handle specific amounts
      const amount = Number(match);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма');
        return;
      }
      await this.bikbetService.withdrawAmount(ctx, amount);
    });

    // FKwallet payment handler: paymentSystem_fkwallet_<amount>
    this.bot.action(/paymentSystem_fkwallet_(.+)/, async (ctx) => {
      const amount = Number((ctx as any).match?.[1]);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма');
        return;
      }
      await ctx.answerCbQuery();
      await this.bikbetService.fkwalletPayment(ctx, amount);
    });

    // YooMoney payment handler: paymentSystem_yoomoney_<amount>
    this.bot.action(/paymentSystem_yoomoney_(.+)/, async (ctx) => {
      const amount = Number((ctx as any).match?.[1]);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма');
        return;
      }
      await ctx.answerCbQuery();
      await this.bikbetService.yoomoneyPayment(ctx, amount);
    });

    // CryptoBot payment handler: paymentSystem_cryptobot_<amount>
    this.bot.action(/paymentSystem_cryptobot_(.+)/, async (ctx) => {
      const amount = Number((ctx as any).match?.[1]);
      if (!Number.isFinite(amount)) {
        await ctx.answerCbQuery('Некорректная сумма');
        return;
      }
      await ctx.answerCbQuery();
      await this.bikbetService.cryptobotPayment(ctx, amount);
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

    // Playslots main balance handler
    this.bot.action('playslots_main', async (ctx) => {
      await this.bikbetService.showOperatorsMenu(ctx, 'main');
    });

    // Playslots bonus balance handler
    this.bot.action('playslots_bonus', async (ctx) => {
      await this.bikbetService.showOperatorsMenu(ctx, 'bonus');
    });

    // Popular games handler
    this.bot.action(/popular_pp_(.+)/, async (ctx) => {
      await this.bikbetService.showPopularGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Operator selection handlers with user ID
    this.bot.action(/operator_pp_(.+)/, async (ctx) => {
      await this.bikbetService.showPragmaticPlayGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_netent_(.+)/, async (ctx) => {
      await this.bikbetService.showNetEntGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_novomatic_(.+)/, async (ctx) => {
      await this.bikbetService.showNovomaticGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_playngo_(.+)/, async (ctx) => {
      await this.bikbetService.showPlaynGoGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_push_(.+)/, async (ctx) => {
      await this.bikbetService.showPushGamingGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_betinhell_(.+)/, async (ctx) => {
      await this.bikbetService.showBetinhellGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_playtech_(.+)/, async (ctx) => {
      await this.bikbetService.showPlayTechGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Pagination handlers for all operators
    this.bot.action(/prev_pragmaticplay_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PragmaticPlay',
        this.bikbetService['PRAGMATIC_GAMES'],
      );
    });

    this.bot.action(/next_pragmaticplay_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PragmaticPlay',
        this.bikbetService['PRAGMATIC_GAMES'],
      );
    });

    this.bot.action(/prev_netent_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'NetEnt',
        this.bikbetService['NETENT_GAMES'],
      );
    });

    this.bot.action(/next_netent_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'NetEnt',
        this.bikbetService['NETENT_GAMES'],
      );
    });

    this.bot.action(/prev_betinhell_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleBetinhellPagination(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/next_betinhell_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleBetinhellPagination(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Generic pagination handlers for all operators
    this.bot.action(/prev_novomatic_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Novomatic',
        this.bikbetService['NOVOMATIC_GAMES'],
      );
    });

    this.bot.action(/next_novomatic_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Novomatic',
        this.bikbetService['NOVOMATIC_GAMES'],
      );
    });

    this.bot.action(/prev_playngo_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PlaynGo',
        this.bikbetService['PLAYNGO_GAMES'],
      );
    });

    this.bot.action(/next_playngo_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PlaynGo',
        this.bikbetService['PLAYNGO_GAMES'],
      );
    });

    this.bot.action(/prev_pushgaming_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PushGaming',
        this.bikbetService['PUSH_GAMES'],
      );
    });

    this.bot.action(/next_pushgaming_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PushGaming',
        this.bikbetService['PUSH_GAMES'],
      );
    });

    this.bot.action(/prev_playtech_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PlayTech',
        this.bikbetService['PLAYTECH_GAMES'],
      );
    });

    this.bot.action(/next_playtech_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'PlayTech',
        this.bikbetService['PLAYTECH_GAMES'],
      );
    });

    this.bot.action(/prev_popular_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Popular',
        this.bikbetService['POPULAR_GAMES'],
      );
    });

    this.bot.action(/next_popular_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Popular',
        this.bikbetService['POPULAR_GAMES'],
      );
    });

    // Back to operators handler
    this.bot.action(/back_to_operators_(.+)/, async (ctx) => {
      await this.bikbetService.backToOperators(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Game selection handlers - using real game IDs
    // Pragmatic Play games - All games
    this.bot.action(/4031_(.+)/, async (ctx) => {
      // Gates of Olympus
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4162_(.+)/, async (ctx) => {
      // Zeus & Hades
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4029_(.+)/, async (ctx) => {
      // Sweet Bonanza
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4068_(.+)/, async (ctx) => {
      // Wolf Gold
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4013_(.+)/, async (ctx) => {
      // Triple Dragons
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4047_(.+)/, async (ctx) => {
      // Big Bass Bonanza
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4089_(.+)/, async (ctx) => {
      // The Dog House Megaways
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4060_(.+)/, async (ctx) => {
      // Sugar Rush
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4052_(.+)/, async (ctx) => {
      // Wild West Gold
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4051_(.+)/, async (ctx) => {
      // Fire Strike 2
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4028_(.+)/, async (ctx) => {
      // The Dog House
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4057_(.+)/, async (ctx) => {
      // Big Bass Splash
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4032_(.+)/, async (ctx) => {
      // Starlight Princess
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4071_(.+)/, async (ctx) => {
      // Money Mouse
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4066_(.+)/, async (ctx) => {
      // Fruit Party
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4077_(.+)/, async (ctx) => {
      // Gems Bonanza
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4045_(.+)/, async (ctx) => {
      // Juicy Fruits
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4118_(.+)/, async (ctx) => {
      // Buffalo King
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4000_(.+)/, async (ctx) => {
      // Book Of Tut
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4001_(.+)/, async (ctx) => {
      // Book of Vikings
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4002_(.+)/, async (ctx) => {
      // Return of the Dead
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4003_(.+)/, async (ctx) => {
      // Scarab Queen
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4004_(.+)/, async (ctx) => {
      // Heart of Rio
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4005_(.+)/, async (ctx) => {
      // Madame Destiny
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4006_(.+)/, async (ctx) => {
      // Ancient Egypt Classic
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4105_(.+)/, async (ctx) => {
      // Wisdom of Athena
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4109_(.+)/, async (ctx) => {
      // Jewel Rush
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4116_(.+)/, async (ctx) => {
      // Supermania
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4139_(.+)/, async (ctx) => {
      // Bali Dragon
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4140_(.+)/, async (ctx) => {
      // Jeitinho Brasileiro
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4141_(.+)/, async (ctx) => {
      // Hokkaido Wolf
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4145_(.+)/, async (ctx) => {
      // Little Gem
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4147_(.+)/, async (ctx) => {
      // 5 Lions Megaways
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4163_(.+)/, async (ctx) => {
      // Rise of Samurai IV
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4170_(.+)/, async (ctx) => {
      // The Conqueror
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4171_(.+)/, async (ctx) => {
      // Hand of Midas 2
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4176_(.+)/, async (ctx) => {
      // The Green Sun
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4186_(.+)/, async (ctx) => {
      // Barbar
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4142_(.+)/, async (ctx) => {
      // Golden Pig
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/4135_(.+)/, async (ctx) => {
      // Moonshot
      await this.bikbetService.handlePragmaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // NetEnt games
    this.bot.action(/1008_(.+)/, async (ctx) => {
      // Starburst
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1084_(.+)/, async (ctx) => {
      // Dead or Alive
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1007_(.+)/, async (ctx) => {
      // Gonzo's Quest
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1096_(.+)/, async (ctx) => {
      // Koi Princess
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1058_(.+)/, async (ctx) => {
      // Jack and the Beanstalk
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1017_(.+)/, async (ctx) => {
      // Elements The Awakening
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1043_(.+)/, async (ctx) => {
      // Jimi Hendrix
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1010_(.+)/, async (ctx) => {
      // Victorious
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1016_(.+)/, async (ctx) => {
      // Space Wars
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1054_(.+)/, async (ctx) => {
      // Aloha
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1034_(.+)/, async (ctx) => {
      // Spinata Grande
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1042_(.+)/, async (ctx) => {
      // Guns'N'Roses
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1001_(.+)/, async (ctx) => {
      // Piggy Riches
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1002_(.+)/, async (ctx) => {
      // Stickers
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1005_(.+)/, async (ctx) => {
      // Flowers
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1003_(.+)/, async (ctx) => {
      // Fruit Shop
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1060_(.+)/, async (ctx) => {
      // Butterfly Staxx
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1019_(.+)/, async (ctx) => {
      // Wild Water
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1063_(.+)/, async (ctx) => {
      // Vikings
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1069_(.+)/, async (ctx) => {
      // Red Riding Hood
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1068_(.+)/, async (ctx) => {
      // Hansel & Gretel
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1067_(.+)/, async (ctx) => {
      // Mirror Mirror
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1066_(.+)/, async (ctx) => {
      // Jungle Spirit
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1065_(.+)/, async (ctx) => {
      // Coins Of Egypt
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1064_(.+)/, async (ctx) => {
      // Blackjack
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1062_(.+)/, async (ctx) => {
      // Jingle Spin
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1061_(.+)/, async (ctx) => {
      // Wild Bazaar
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1059_(.+)/, async (ctx) => {
      // Halloween Jack
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1057_(.+)/, async (ctx) => {
      // Witch Craft Academy
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1056_(.+)/, async (ctx) => {
      // Double Stacks
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1055_(.+)/, async (ctx) => {
      // Dracula
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1053_(.+)/, async (ctx) => {
      // HotLine
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1052_(.+)/, async (ctx) => {
      // Hooks Heroes
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1051_(.+)/, async (ctx) => {
      // Scruffy Duck
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1070_(.+)/, async (ctx) => {
      // Golden Grimoire
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1071_(.+)/, async (ctx) => {
      // European Roulette Low Limit
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1082_(.+)/, async (ctx) => {
      // Wild Turkey
      await this.bikbetService.handleNetEntGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Novomatic games - All games
    this.bot.action(/12_(.+)/, async (ctx) => {
      // Book of Ra Classic
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/63_(.+)/, async (ctx) => {
      // Lucky Lady
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/69_(.+)/, async (ctx) => {
      // Money Game
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5_(.+)/, async (ctx) => {
      // Bananas Go Bahamas
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/13_(.+)/, async (ctx) => {
      // Book of ra deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/107_(.+)/, async (ctx) => {
      // Always Hot
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/64_(.+)/, async (ctx) => {
      // Lucky Lady's deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/70_(.+)/, async (ctx) => {
      // Money game deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/105_(.+)/, async (ctx) => {
      // Always Hot Deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/92_(.+)/, async (ctx) => {
      // Sizzling Hot Deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/117_(.+)/, async (ctx) => {
      // Sizzling Crowns
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/26_(.+)/, async (ctx) => {
      // Dolphin's Pearl Deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/25_(.+)/, async (ctx) => {
      // Dolphins pearl classic
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/61_(.+)/, async (ctx) => {
      // Lord of the Ocean
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/76_(.+)/, async (ctx) => {
      // Pharaohs Gold II Deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/68_(.+)/, async (ctx) => {
      // Mario
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/104_(.+)/, async (ctx) => {
      // Always Hot Cubes
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/81_(.+)/, async (ctx) => {
      // Reel King
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/34_(.+)/, async (ctx) => {
      // Fruit farm
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/1_(.+)/, async (ctx) => {
      // Alchemist
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/54_(.+)/, async (ctx) => {
      // Just jewels
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/47_(.+)/, async (ctx) => {
      // Helena
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/86_(.+)/, async (ctx) => {
      // Sea sirens
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/21_(.+)/, async (ctx) => {
      // Cryptic highway
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/55_(.+)/, async (ctx) => {
      // Just jewels deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/24_(.+)/, async (ctx) => {
      // Diamond 7
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/48_(.+)/, async (ctx) => {
      // Hot cubes
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/36_(.+)/, async (ctx) => {
      // Fruits and royals
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/51_(.+)/, async (ctx) => {
      // Inferno
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/90_(.+)/, async (ctx) => {
      // Sizzling gems
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/37_(.+)/, async (ctx) => {
      // Fruit sensation
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/72_(.+)/, async (ctx) => {
      // Mystery star
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/23_(.+)/, async (ctx) => {
      // Dazzling diamonds
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/65_(.+)/, async (ctx) => {
      // Mafia
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/40_(.+)/, async (ctx) => {
      // Glittering peaks
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/20_(.+)/, async (ctx) => {
      // Cosmic miracle
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/58_(.+)/, async (ctx) => {
      // Knightly valor
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/45_(.+)/, async (ctx) => {
      // Gryphons gold deluxe
      await this.bikbetService.handleNovomaticGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // PlaynGo games - All games
    this.bot.action(/3004_(.+)/, async (ctx) => {
      // Book of Dead
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3007_(.+)/, async (ctx) => {
      // Legacy of Dead
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3022_(.+)/, async (ctx) => {
      // Reactoonz
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3033_(.+)/, async (ctx) => {
      // Fire Joker
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3036_(.+)/, async (ctx) => {
      // Gold King
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3061_(.+)/, async (ctx) => {
      // Rise Of Athena
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3052_(.+)/, async (ctx) => {
      // Xmas Joker
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3085_(.+)/, async (ctx) => {
      // Legion Gold
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3042_(.+)/, async (ctx) => {
      // Fu Er Dai
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3028_(.+)/, async (ctx) => {
      // Myth
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3026_(.+)/, async (ctx) => {
      // Amulet Of Dead
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3000_(.+)/, async (ctx) => {
      // Jewel Box
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3024_(.+)/, async (ctx) => {
      // Chinese New Year
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3045_(.+)/, async (ctx) => {
      // Lost Chapter
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3079_(.+)/, async (ctx) => {
      // Scroll Of Seth
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3091_(.+)/, async (ctx) => {
      // Tome of Madness
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3015_(.+)/, async (ctx) => {
      // Star Joker
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3089_(.+)/, async (ctx) => {
      // Boat Bonanza
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3011_(.+)/, async (ctx) => {
      // Fortune Teller
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3046_(.+)/, async (ctx) => {
      // King's Mask
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3017_(.+)/, async (ctx) => {
      // Golden Legend
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3027_(.+)/, async (ctx) => {
      // Pearl Lagoon
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3030_(.+)/, async (ctx) => {
      // Inferno Star
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3048_(.+)/, async (ctx) => {
      // Pyramids of Dead
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3002_(.+)/, async (ctx) => {
      // Samba Carnival
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3073_(.+)/, async (ctx) => {
      // Diamonds of the Realm
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3069_(.+)/, async (ctx) => {
      // the Sword and the Grail
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3070_(.+)/, async (ctx) => {
      // Ice Joker
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3057_(.+)/, async (ctx) => {
      // Legacy Of Inca
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3041_(.+)/, async (ctx) => {
      // Merlin And Morgana
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3059_(.+)/, async (ctx) => {
      // Crystal Sun
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3064_(.+)/, async (ctx) => {
      // Immor Tails
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3035_(.+)/, async (ctx) => {
      // Rise Of Dead
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/3037_(.+)/, async (ctx) => {
      // Dawn Of Egypt
      await this.bikbetService.handlePlaynGoGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Push Gaming games - All games
    this.bot.action(/5008_(.+)/, async (ctx) => {
      // Jammin Jars
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5007_(.+)/, async (ctx) => {
      // Razor Shark
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5001_(.+)/, async (ctx) => {
      // Fat Rabbit
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5019_(.+)/, async (ctx) => {
      // TikiTumble
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5010_(.+)/, async (ctx) => {
      // Retro Tapes
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5016_(.+)/, async (ctx) => {
      // Fish 'n' Nudge
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5000_(.+)/, async (ctx) => {
      // Hearts Highway
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5002_(.+)/, async (ctx) => {
      // Fat Santa
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5003_(.+)/, async (ctx) => {
      // 10 Swords
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5005_(.+)/, async (ctx) => {
      // Fire Hopper
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5006_(.+)/, async (ctx) => {
      // Blaze Of Ra
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5009_(.+)/, async (ctx) => {
      // Deadly 5
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5011_(.+)/, async (ctx) => {
      // Fat Banker
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5012_(.+)/, async (ctx) => {
      // Bison Battle
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5013_(.+)/, async (ctx) => {
      // Crystal Catcher
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5014_(.+)/, async (ctx) => {
      // Giga Jar
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5015_(.+)/, async (ctx) => {
      // Joker Troupe
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5017_(.+)/, async (ctx) => {
      // Mystery Mission To The Moon
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5018_(.+)/, async (ctx) => {
      // Rat King
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5020_(.+)/, async (ctx) => {
      // Generous Jack
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5021_(.+)/, async (ctx) => {
      // Dinopolis
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5022_(.+)/, async (ctx) => {
      // Jaguar Drop
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5023_(.+)/, async (ctx) => {
      // Dj Cat
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5024_(.+)/, async (ctx) => {
      // BigBite
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5025_(.+)/, async (ctx) => {
      // Big Bam Book
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5026_(.+)/, async (ctx) => {
      // Retro Sweets
      await this.bikbetService.handlePushGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // BetInHell games - All games
    this.bot.action(/533_(.+)/, async (ctx) => {
      // Book Of Sunrise
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/536_(.+)/, async (ctx) => {
      // Frozen Rich Joker
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/534_(.+)/, async (ctx) => {
      // Book Of Dark Sun
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/521_(.+)/, async (ctx) => {
      // Cleopatra's Diary
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/537_(.+)/, async (ctx) => {
      // Joker Win Spin
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/519_(.+)/, async (ctx) => {
      // Deep Blue Sea
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/500_(.+)/, async (ctx) => {
      // Treasure of Shaman
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/523_(.+)/, async (ctx) => {
      // Divine Carnival
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/508_(.+)/, async (ctx) => {
      // Gemstone Of Aztec
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/511_(.+)/, async (ctx) => {
      // Horror Castle
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/518_(.+)/, async (ctx) => {
      // Super Hamster
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/509_(.+)/, async (ctx) => {
      // Goblins Land
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/524_(.+)/, async (ctx) => {
      // Don Slottione
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/505_(.+)/, async (ctx) => {
      // Lapland
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/506_(.+)/, async (ctx) => {
      // Cheerful farmer
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/510_(.+)/, async (ctx) => {
      // Space Battle
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/501_(.+)/, async (ctx) => {
      // Sweet paradise
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/514_(.+)/, async (ctx) => {
      // Evil Genotype
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/513_(.+)/, async (ctx) => {
      // Revenge of cyborgs
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/503_(.+)/, async (ctx) => {
      // Sea underwater club
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/502_(.+)/, async (ctx) => {
      // Maniac house
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/504_(.+)/, async (ctx) => {
      // Forest ant
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/531_(.+)/, async (ctx) => {
      // Joker Strike Again
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/532_(.+)/, async (ctx) => {
      // Book Of Sahara
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/529_(.+)/, async (ctx) => {
      // Romance V
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/530_(.+)/, async (ctx) => {
      // The Sword & The Magic
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/520_(.+)/, async (ctx) => {
      // Imhotep Manuscript
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/516_(.+)/, async (ctx) => {
      // Warlock's Book
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/515_(.+)/, async (ctx) => {
      // Wild Rodeo
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/512_(.+)/, async (ctx) => {
      // Brave Mongoose
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/522_(.+)/, async (ctx) => {
      // Spin Joker Spin
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/517_(.+)/, async (ctx) => {
      // Resident 3D
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/507_(.+)/, async (ctx) => {
      // Gates Of Hell
      await this.bikbetService.handleBetinhellGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // PlayTech games - All games
    this.bot.action(/4_(.+)/, async (ctx) => {
      // Azteca
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/74_(.+)/, async (ctx) => {
      // New Year Girls
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/75_(.+)/, async (ctx) => {
      // Nights
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/84_(.+)/, async (ctx) => {
      // Rome & Glory
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/100_(.+)/, async (ctx) => {
      // Viking Striking
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/82_(.+)/, async (ctx) => {
      // Riddle Jungle
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/97_(.+)/, async (ctx) => {
      // Thai Paradise
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/102_(.+)/, async (ctx) => {
      // World Travel
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/22_(.+)/, async (ctx) => {
      // Cute And Fluffy
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/60_(.+)/, async (ctx) => {
      // Le Comte de Monte Cristo
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/73_(.+)/, async (ctx) => {
      // New Space Adventure
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/14_(.+)/, async (ctx) => {
      // Captain's Treasure Pro
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/78_(.+)/, async (ctx) => {
      // Pirates Slots
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/83_(.+)/, async (ctx) => {
      // Rockabilly
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    // Popular games - All games (these use different handlers based on provider)
    this.bot.action(/6000_(.+)/, async (ctx) => {
      // Dancing Joker (3 Oaks Gaming)
      await this.bikbetService.handlePopularGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/6001_(.+)/, async (ctx) => {
      // Coin Express (3 Oaks Gaming)
      await this.bikbetService.handlePopularGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/6002_(.+)/, async (ctx) => {
      // Big Heist (3 Oaks Gaming)
      await this.bikbetService.handlePopularGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/5032_(.+)/, async (ctx) => {
      // Big Bamboo (Push Gaming)
      await this.bikbetService.handlePopularGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });
    this.bot.action(/75_(.+)/, async (ctx) => {
      // Nights
      await this.bikbetService.handlePlayTechGameSelection(
        ctx,
        (ctx.callbackQuery as any).data,
      );
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

    // Withdraw Custom handler is now handled by the dynamic withdraw handler above

    //My Bounses button click handler
    this.bot.action('myBonuses', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.myBonuses(ctx);
    });

    this.bot.launch();
  }
}
