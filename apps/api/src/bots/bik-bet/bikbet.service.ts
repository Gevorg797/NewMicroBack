import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
  User,
  Currency,
  Balances,
  CurrencyType,
  Site,
  BalanceType,
  PaymentPayoutRequisite,
  Bonuses,
  BonusStatus,
  BalancesHistory,
} from '@lib/database';
import { Markup } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  GAMINATOR_GAME_NAMES_WITH_IDS,
  GAMINATOR2_GAME_NAMES_WITH_IDS,
  NETENT_GAME_NAMES_WITH_IDS,
  EGT_GAME_NAMES_WITH_IDS,
  WAZDAN_GAME_NAMES_WITH_IDS,
  IGROSOFT_GAME_NAMES_WITH_IDS,
  GameData,
} from './games-data';
import { PaymentService } from '../../client/payment/payment.service';
import { StatsService } from '../../stats/stats.service';
import { SelfCleaningMap } from 'libs/utils/data-structures/self-cleaning-map';
import { log } from 'console';

@Injectable()
export class BikBetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BikBetService.name);
  private readonly chatIdForDepositsAndWithdrawals = -1002939266999; // Replace with your actual chat ID
  private readonly userStates = new Map<
    number,
    {
      chosenBalance?: string;
      state?: string;
      withdrawAmount?: number;
      withdrawMethod?: string;
      withdrawMethodId?: number;
      targetUserId?: number;
      rejectionData?: {
        withdrawalId: number;
        method: string;
        adminId: number;
        messageId: number;
        userTgId: number;
        amount: number;
      };
    }
  >();
  // Use SelfCleaningMap to prevent memory leaks from unbounded growth
  private readonly currentPage = new SelfCleaningMap<number, number>(5000, 0.3);
  private readonly lastMessageId = new SelfCleaningMap<number, number>(
    5000,
    0.3,
  );
  private readonly ITEMS_PER_PAGE = 10;
  private readonly SECRET_KEY = 'h553k34n45mktkm55143a';
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Currency)
    private readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(Balances)
    private readonly balancesRepository: EntityRepository<Balances>,
    @InjectRepository(PaymentPayoutRequisite)
    private readonly paymentPayoutRequisiteRepository: EntityRepository<PaymentPayoutRequisite>,
    @InjectRepository(Bonuses)
    private readonly bonusesRepository: EntityRepository<Bonuses>,
    @InjectRepository(BalancesHistory)
    private readonly balancesHistoryRepository: EntityRepository<BalancesHistory>,
    private readonly paymentService: PaymentService,
    private readonly statsService: StatsService,
    private readonly em: EntityManager,
  ) {}

  // Game data for different operators (referenced directly to save memory)
  private readonly PRAGMATIC_GAMES = GAMINATOR2_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
      provider: game.provider,
    }),
  );

  private readonly NETENT_GAMES = NETENT_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
    provider: game.provider,
  }));

  private readonly NOVOMATIC_GAMES = GAMINATOR_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
      provider: game.provider,
    }),
  );

  private readonly PLAYNGO_GAMES = EGT_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
    provider: game.provider,
  }));

  private readonly PUSH_GAMES = WAZDAN_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
    provider: game.provider,
  }));

  private readonly BETINHELL_GAMES = IGROSOFT_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
      provider: game.provider,
    }),
  );

  private readonly PLAYTECH_GAMES = GAMINATOR_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
      provider: game.provider,
    }),
  );

  private readonly POPULAR_GAMES = GAMINATOR2_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
      provider: game.provider,
    }),
  );

  // Generate user authentication token
  private generateUserAuthToken(userId: number): string {
    const message = `user_${userId}_slot_auth`;
    const secret = this.SECRET_KEY;
    const hmacHash = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
    return `slot_${userId}_${hmacHash.substring(0, 16)}`;
  }

  async checkSubscription(ctx: any, channelId: string, link: string) {
    try {
      const member = await ctx.telegram.getChatMember(channelId, ctx.from.id);

      if (member.status === 'left' || member.status === 'kicked') {
        return await this.sendSubscriptionPrompt(ctx, link);
      }

      // Ensure user exists and has default RUB balance
      const telegramId = String(ctx.from.id);

      // Use transaction to prevent race conditions
      const em = this.userRepository.getEntityManager();

      let user = await this.userRepository.findOne({ telegramId });

      if (!user) {
        try {
          await em.transactional(async (em) => {
            // Double-check user doesn't exist inside transaction
            user = await em.findOne(User, { telegramId });

            if (!user) {
              const fallbackName = (
                (ctx.from.first_name ?? '') +
                ' ' +
                (ctx.from.last_name ?? '')
              ).trim();
              const derivedName =
                (ctx.from.username ?? fallbackName) || undefined;
              const siteId = 1;
              const siteRef = await em.findOne(Site, { id: siteId });

              if (!siteRef) {
                throw new Error('Default site not found');
              }

              user = em.create(User, {
                telegramId,
                name: derivedName,
                site: siteRef,
              } as any);

              await em.persistAndFlush(user);

              // Create balances in the same transaction
              const rub = await em.findOne(Currency, {
                name: CurrencyType.RUB,
              });

              if (rub) {
                const mainBalance = em.create(Balances, {
                  user,
                  currency: rub,
                  balance: 0,
                  type: BalanceType.MAIN,
                });

                const bonusBalance = em.create(Balances, {
                  user,
                  currency: rub,
                  balance: 0,
                  type: BalanceType.BONUS,
                });

                await em.persistAndFlush([mainBalance, bonusBalance]);
              }
            }
          });
        } catch (error) {
          // If user was created by another request, fetch it
          if (error.code === '23505') {
            user = await this.userRepository.findOne({ telegramId });
          } else {
            throw error;
          }
        }
      }

      // Ensure balances exist (in case user existed but balances didn't)
      if (user) {
        const existingBalances = await this.balancesRepository.find({ user });

        if (existingBalances.length === 0) {
          const rub = await this.currencyRepository.findOne({
            name: CurrencyType.RUB,
          });

          if (rub && user) {
            try {
              await em.transactional(async (em) => {
                // Double-check balances don't exist
                const check = await em.find(Balances, { user: user! });

                if (check.length === 0) {
                  const mainBalance = em.create(Balances, {
                    user: user!,
                    currency: rub,
                    balance: 0,
                    type: BalanceType.MAIN,
                  } as any);

                  const bonusBalance = em.create(Balances, {
                    user: user!,
                    currency: rub,
                    balance: 0,
                    type: BalanceType.BONUS,
                  } as any);

                  await em.persistAndFlush([mainBalance, bonusBalance]);
                }
              });
            } catch (error) {
              // Balances might have been created by another request
              console.log(
                'Balance creation conflict, ignoring:',
                error.message,
              );
            }
          }
        }
      }

      // Get real-time stats
      const stats = await this.statsService.getMainStats();

      const text = `
<blockquote><b>Добро пожаловать в <a href="${link}">BikBet!</a></b></blockquote>
<blockquote>👥 <b>Всего игроков:</b> <code>${stats.totalPlayers}</code></blockquote>
<blockquote>🚀 <b>Сыграно игр:</b>
⤷ <code>${stats.gamesPlayed}</code>
💸 <b>Сумма ставок:</b>
⤷ <code>${stats.totalBets.toFixed(2)} RUB</code></blockquote>
`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎰 Играть!', 'games')],
        [
          Markup.button.callback('💰 Баланс', 'donate_menu'),
          Markup.button.callback('⚙️ Профиль', 'profile'),
        ],
        [
          Markup.button.callback('🏆 Топы', 'leaderboard_wins'),
          Markup.button.callback('📚 Информация', 'info'),
        ],
        [Markup.button.callback('🎁 Бонусы', 'bonuses')],
      ]);

      // Check if this is a callback query (button click) or a text message
      if (ctx.callbackQuery) {
        // It's a callback query, answer it first
        try {
          await ctx.answerCbQuery();
        } catch (error) {
          console.log('Callback query already answered:', error.message);
        }

        // Then edit the message
        const filePath = this.getImagePath('bik_bet_8.jpg');
        const media: any = {
          type: 'photo',
          media: { source: fs.readFileSync(filePath) },
          caption: text,
          parse_mode: 'HTML',
        };

        await ctx.editMessageMedia(media, {
          reply_markup: keyboard.reply_markup,
        });
      } else {
        // It's a text message (like /start), send a new reply with photo
        await ctx.replyWithPhoto(
          { source: fs.createReadStream(this.getImagePath('bik_bet_8.jpg')) },
          {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup,
          },
        );
      }
    } catch (error) {
      console.error('Subscription check error:', error);
      await this.sendSubscriptionPrompt(ctx, link, true);
    }
  }

  private async sendSubscriptionPrompt(
    ctx: any,
    link: string,
    isError = false,
  ) {
    const message = isError
      ? `❌ Не удалось проверить подписку. Пожалуйста, подпишитесь на канал:\n${link}`
      : `❗️Для использования бота необходимо подписаться на канал!\nДальше отправьте команду /start, либо же нажмите кнопку ниже`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 Подписаться', link)],
      [Markup.button.callback('🔄 Проверить подписку', 'check_subscription')],
    ]);

    // Check if this is a callback query (button click) or a text message
    if (ctx.callbackQuery) {
      // It's a callback query, show an alert instead of editing the same message
      try {
        await ctx.telegram.answerCbQuery(
          ctx.callbackQuery.id,
          '❌ Вы еще не подписались на канал. Пожалуйста, подпишитесь и попробуйте снова.',
          { show_alert: true },
        );
        console.log('Subscription alert sent successfully');
      } catch (error) {
        console.error('Error sending subscription alert:', error);
      }
      return;
    } else {
      // It's a text message (like /start), send a new reply
      await ctx.reply(message, keyboard);
    }
  }

  private getImagePath(imageName): string {
    return path.join(
      process.cwd(),
      'apps',
      'api',
      'src',
      'bots',
      'bik-bet',
      'images',
      imageName,
    );
  }

  async game(ctx: any) {
    try {
      const telegramId = String(ctx.from.id);
      const user = await this.userRepository.findOne({ telegramId });

      if (!user) {
        await ctx.reply('❌ Пользователь не найден');
        return;
      }

      // Get user's main balance
      const mainBalance = await this.balancesRepository.findOne({
        user: user,
        type: BalanceType.MAIN,
      });

      // Get user's bonus balance
      const bonusBalance = await this.balancesRepository.findOne({
        user: user,
        type: BalanceType.BONUS,
      });

      const mainBalanceAmount = Math.round(mainBalance?.balance || 0);
      const bonusBalanceAmount = Math.round(bonusBalance?.balance || 0);

      const text = `
<blockquote><b>🎮 Выберите игру:</b></blockquote>
<blockquote><b>💰 Ваш баланс:</b> <code>${mainBalanceAmount}</code></blockquote>
<blockquote><b>🎁 Ваш бонусный баланс: ${bonusBalanceAmount}</b></blockquote>
`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Базовые игры', 'ignore_all')],
          [
            Markup.button.callback('🎲 Дайсы', 'ignore_all'),
            Markup.button.callback('⚽️ Футбол', 'ignore_all'),
            Markup.button.callback('🎯 Дартс', 'ignore_all'),
          ],
          [
            Markup.button.callback('🎳 Боулинг', 'ignore_all'),
            Markup.button.callback('🍭 Слот', 'ignore_all'),
            Markup.button.callback('🏀 Баскетбол', 'ignore_all'),
          ],
          [Markup.button.callback('Настоящие игры', 'ignore_all')],
          [Markup.button.callback('🎰 Слоты', 'slots')],
          [Markup.button.callback('Мультиплеер', 'ignore_all')],
          [
            Markup.button.callback('⚔️ PVP', 'ignore_all'),
            Markup.button.callback('💰 Аукцион', 'ignore_all'),
          ],
          [Markup.button.callback('💸 Пополнить баланс', 'donate')],
          [Markup.button.callback('⬅️ Назад', 'start')],
        ]).reply_markup,
      });
    } catch (error) {
      console.error('Error in game function:', error);
      await ctx.reply('❌ Ошибка при загрузке игр');
    }
  }

  async start(ctx: any, link: string) {
    // Get real-time stats
    const stats = await this.statsService.getMainStats();

    const text = `
<blockquote><b>Добро пожаловать в <a href="${link}">BikBet!</a></b></blockquote>
<blockquote>👥 <b>Всего игроков:</b> <code>${stats.totalPlayers}</code></blockquote>
<blockquote>🚀 <b>Сыграно игр:</b>
⤷ <code>${stats.gamesPlayed}</code>
💸 <b>Сумма ставок:</b>
⤷ <code>${stats.totalBets.toFixed(2)} RUB</code></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_8.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🎰 Играть!', 'games')],
        [
          Markup.button.callback('💰 Баланс', 'donate_menu'),
          Markup.button.callback('⚙️ Профиль', 'profile'),
        ],
        [
          Markup.button.callback('🏆 Топы', 'leaderboard_wins'),
          Markup.button.callback('📚 Информация', 'info'),
        ],
        [Markup.button.callback('🎁 Бонусы', 'bonuses')],
      ]).reply_markup,
    });
  }

  async slots(ctx: any) {
    const text = `
<blockquote><b>🎰 Выберите баланс на котором будете играть:</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_2.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('💰 Основной', 'playslots_main')],
        [Markup.button.callback('🎁 Бонусный', 'playslots_bonus')],
        [Markup.button.callback('⬅️ Назад', 'games')],
      ]).reply_markup,
    });
  }

  async showOperatorsMenu(ctx: any, chosenBalance: string) {
    const userId = ctx.from.id;

    try {
      // Store the chosen balance in user state
      this.userStates.set(userId, { chosenBalance, state: 'select_operator' });

      const text = `<blockquote><b>🎰 Выберите оператора:</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔥Популярные🔥', `popular_pp_${userId}`)],
          [
            Markup.button.callback('Pragmatic Play', `operator_pp_${userId}`),
            Markup.button.callback('NetEnt', `operator_netent_${userId}`),
          ],
          [
            Markup.button.callback('Novomatic', `operator_novomatic_${userId}`),
            Markup.button.callback('PlaynGo', `operator_playngo_${userId}`),
          ],
          [
            Markup.button.callback('PushGaming', `operator_push_${userId}`),
            Markup.button.callback('BetInHell', `operator_betinhell_${userId}`),
          ],
          [Markup.button.callback('PlayTech', `operator_playtech_${userId}`)],
          [Markup.button.callback('🔙 Назад', 'slots')],
        ]).reply_markup,
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Update error:', error);
      await ctx.answerCbQuery('⚠ Не удалось обновить', { show_alert: true });
    }
  }

  // Helper method to get user state
  getUserState(userId: number) {
    return this.userStates.get(userId) || {};
  }

  // Helper method to validate user and extract user ID from callback data
  private validateUserAndExtractId(
    ctx: any,
    callbackData: string,
  ): number | null {
    try {
      const userId = parseInt(callbackData.split('_').pop() || '0');

      if (!userId || ctx.from.id !== userId) {
        return null;
      }
      return userId;
    } catch {
      return null;
    }
  }

  // Optimized BetInHell games handler using generic method
  async showBetinhellGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'BetInHell',
      this.BETINHELL_GAMES,
    );
  }

  // Handle BetInHell pagination using generic method
  async handleBetinhellPagination(ctx: any, callbackData: string) {
    await this.handleOperatorPagination(
      ctx,
      callbackData,
      'BetInHell',
      this.BETINHELL_GAMES,
    );
  }

  // Operator handlers using real game data
  async showPragmaticPlayGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'PragmaticPlay',
      this.PRAGMATIC_GAMES,
    );
  }

  async showNetEntGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'NetEnt',
      this.NETENT_GAMES,
    );
  }

  async showNovomaticGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'Novomatic',
      this.NOVOMATIC_GAMES,
    );
  }

  async showPlaynGoGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'PlaynGo',
      this.PLAYNGO_GAMES,
    );
  }

  async showPushGamingGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'PushGaming',
      this.PUSH_GAMES,
    );
  }

  async showPlayTechGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'PlayTech',
      this.PLAYTECH_GAMES,
    );
  }

  // Helper method to safely answer callback queries
  private async safeAnswerCbQuery(
    ctx: any,
    text?: string,
    options?: any,
  ): Promise<boolean> {
    try {
      if (text) {
        await ctx.answerCbQuery(text, options);
      } else {
        await ctx.answerCbQuery();
      }
      return true;
    } catch (error) {
      // Silently ignore callback query errors (already answered or expired)
      return false;
    }
  }

  // Helper method to safely edit message media with proper error handling
  private async safeEditMessageMedia(
    ctx: any,
    media: any,
    extra?: any,
  ): Promise<boolean> {
    try {
      await ctx.editMessageMedia(media, extra);
      return true;
    } catch (error: any) {
      // Ignore common Telegram errors that are not critical
      if (error.response?.description) {
        const desc = error.response.description;
        if (
          desc.includes('message is not modified') ||
          desc.includes('canceled by new editMessageMedia') ||
          desc.includes('message to edit not found')
        ) {
          // These are expected errors, just log them
          return false;
        }
      }
      // Re-throw unexpected errors
      throw error;
    }
  }

  async showPopularGames(ctx: any, callbackData: string) {
    await this.showOperatorGames(
      ctx,
      callbackData,
      'Popular',
      this.POPULAR_GAMES,
    );
  }

  // Generic operator games handler (reusable for all operators)
  async showOperatorGames(
    ctx: any,
    callbackData: string,
    operatorName: string,
    games: Array<{ id: string; name: string }>,
  ) {
    try {
      const userId = this.validateUserAndExtractId(ctx, callbackData);
      if (!userId) {
        await this.safeAnswerCbQuery(ctx, '⚠ Это действие недоступно', {
          show_alert: true,
        });
        return;
      }

      // Answer callback query first
      await this.safeAnswerCbQuery(ctx);

      // Update user state and reset pagination
      this.userStates.set(userId, {
        ...this.getUserState(userId),
        state: 'select_game',
      });
      this.currentPage.set(userId, 0);

      const text = `<blockquote><b>🎰 Выберите игру ${operatorName}:</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await this.safeEditMessageMedia(ctx, media, {
        reply_markup: this.buildOperatorGamesKeyboard(
          0,
          userId,
          operatorName,
          games,
        ).reply_markup,
      });

      this.lastMessageId.set(userId, ctx.message?.message_id || 0);
    } catch (error) {
      console.error(`Error in show${operatorName}Games:`, error);
    }
  }

  // Generic operator games keyboard builder
  private buildOperatorGamesKeyboard(
    page: number,
    userId: number,
    operatorName: string,
    games: Array<{ id: string; name: string }>,
  ) {
    const totalPages = Math.ceil(games.length / this.ITEMS_PER_PAGE);
    const startIndex = page * this.ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + this.ITEMS_PER_PAGE, games.length);
    const pageGames = games.slice(startIndex, endIndex);

    const keyboard: any[][] = [];

    // Add games in rows of 2
    for (let i = 0; i < pageGames.length; i += 2) {
      const row: any[] = [];
      const gameTitle =
        page === 0 && i < 2 ? `🔥 ${pageGames[i].name}` : pageGames[i].name;

      row.push(
        Markup.button.callback(
          gameTitle,
          `${pageGames[i].id}_${userId}_${operatorName}`,
        ),
      );

      if (i + 1 < pageGames.length) {
        const secondGameTitle =
          page === 0 && i + 1 < 2
            ? `🔥 ${pageGames[i + 1].name}`
            : pageGames[i + 1].name;
        row.push(
          Markup.button.callback(
            secondGameTitle,
            `${pageGames[i + 1].id}_${userId}_${operatorName}`,
          ),
        );
      }

      keyboard.push(row);
    }

    // Add pagination controls if needed
    if (totalPages > 1) {
      const paginationRow: any[] = [];

      if (page > 0) {
        paginationRow.push(
          Markup.button.callback(
            '⬅ Назад',
            `prev_${operatorName.toLowerCase()}_page_${page - 1}_${userId}`,
          ),
        );
      }

      if (page < totalPages - 1) {
        paginationRow.push(
          Markup.button.callback(
            'Вперед ➡',
            `next_${operatorName.toLowerCase()}_page_${page + 1}_${userId}`,
          ),
        );
      }

      if (paginationRow.length > 0) {
        keyboard.push(paginationRow);
      }
    }

    // Add exit button
    keyboard.push([
      Markup.button.callback('Выйти', `back_to_operators_${userId}`),
    ]);

    return Markup.inlineKeyboard(keyboard);
  }

  // Generic pagination handler
  async handleOperatorPagination(
    ctx: any,
    callbackData: string,
    operatorName: string,
    games: Array<{ id: string; name: string }>,
  ) {
    // Always answer callback query first to prevent timeout
    try {
      await ctx.answerCbQuery();
    } catch (error) {
      // Ignore callback query errors (already answered or expired)
      this.logger.log('Callback query already answered or expired');
    }

    try {
      const parts = callbackData.split('_');
      const page = parseInt(parts[3]); // parts[3] is the page number
      const userId = parseInt(parts[4]); // parts[4] is the userId

      if (!userId || ctx.from.id !== userId) {
        await ctx.answerCbQuery('⚠ Это действие недоступно', {
          show_alert: true,
        });
        return;
      }

      const text = `<blockquote><b>🎰 Выберите игру ${operatorName}:</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: this.buildOperatorGamesKeyboard(
          page,
          userId,
          operatorName,
          games,
        ).reply_markup,
      });

      this.currentPage.set(userId, page);
    } catch (error) {
      this.logger.error(`Error in handle${operatorName}Pagination:`, error);
    }
  }

  // Back to operators handler
  async backToOperators(ctx: any, callbackData: string) {
    // Always answer callback query first to prevent timeout
    try {
      await ctx.answerCbQuery();
    } catch (error) {
      // Ignore callback query errors (already answered or expired)
      console.log('Callback query already answered or expired');
    }

    try {
      const userId = this.validateUserAndExtractId(ctx, callbackData);
      if (!userId) {
        await ctx.answerCbQuery('⚠ Это действие недоступно', {
          show_alert: true,
        });
        return;
      }

      this.userStates.set(userId, {
        ...this.getUserState(userId),
        state: 'select_operator',
      });

      const text = `<blockquote><b>🎰 Выберите оператора:</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: this.buildOperatorKeyboard(userId).reply_markup,
      });
    } catch (error) {
      console.error('Error in backToOperators:', error);
    }
  }

  // Build operator keyboard
  private buildOperatorKeyboard(userId: number) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔥Популярные🔥', `popular_pp_${userId}`)],
      [
        Markup.button.callback('Pragmatic Play', `operator_pp_${userId}`),
        Markup.button.callback('NetEnt', `operator_netent_${userId}`),
      ],
      [
        Markup.button.callback('Novomatic', `operator_novomatic_${userId}`),
        Markup.button.callback('PlaynGo', `operator_playngo_${userId}`),
      ],
      [
        Markup.button.callback('PushGaming', `operator_push_${userId}`),
        Markup.button.callback('BetInHell', `operator_betinhell_${userId}`),
      ],
      [Markup.button.callback('PlayTech', `operator_playtech_${userId}`)],
      [Markup.button.callback('🔙 Назад', 'slots')],
    ]);
  }

  // Game selection handlers
  async handleGameSelection(
    ctx: any,
    callbackData: string,
    gameId: string,
    gameName: string,
    operatorName: string,
    providerName: string,
  ) {
    // Always answer callback query first to prevent timeout
    try {
      await ctx.answerCbQuery();
    } catch (error) {
      // Ignore callback query errors (already answered or expired)
      console.log('Callback query already answered or expired');
    }

    try {
      const userId = this.validateUserAndExtractId(ctx, callbackData);

      if (!userId) {
        await ctx.answerCbQuery('⚠ Это действие недоступно', {
          show_alert: true,
        });
        return;
      }

      const user = await this.userRepository.findOne({
        telegramId: String(userId),
      });

      if (!user) {
        const message = '⚠ Пользователь не найден. Нажмите /start';
        await ctx.reply(message);
        return;
      }

      const userState = this.getUserState(userId);
      const chosenBalance = userState.chosenBalance || 'main';

      const operatorId = 40272;
      const currency = 'RUB';
      const language = 'RU';

      const baseUrl = `https://dev.bik-bet.com/gamesbycode/gamecode`;
      const params = {
        operator_id: operatorId,
        siteId: 1,
        gameId: gameId,
        user_id: String(user.id),
        currency: currency,
        language: language,
        provider: providerName,
        balanceType: chosenBalance,
      };

      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      const webAppUrl = `${baseUrl}?${queryString}`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(`🎮 Играть в ${gameName}`, webAppUrl)],
        [
          Markup.button.callback(
            '⬅ Назад к списку игр',
            `operator_${operatorName.toLowerCase()}_${userId}`,
          ),
          Markup.button.callback(
            '🔙 Назад к операторам',
            `back_to_operators_${userId}`,
          ),
        ],
      ]);

      const caption =
        `<blockquote>🎰 Вы выбрали игру: ${gameName}</blockquote>\n` +
        `<blockquote><b>Нажмите кнопку ниже, чтобы начать играть</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_1.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: caption,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      console.error(`Error in handleGameSelection for ${operatorName}:`, error);
    }
  }

  // Specific game selection handlers for each operator
  async handlePragmaticGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.PRAGMATIC_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'PragmaticPlay',
        String(game.provider),
      );
    }
  }

  async handleNetEntGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.NETENT_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'NetEnt',
        String(game.provider),
      );
    }
  }

  async handleNovomaticGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.NOVOMATIC_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'Novomatic',
        String(game.provider),
      );
    }
  }

  async handlePlaynGoGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.PLAYNGO_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'PlaynGo',
        String(game.provider),
      );
    }
  }

  async handlePushGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.PUSH_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'PushGaming',
        String(game.provider),
      );
    }
  }

  async handleBetinhellGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.BETINHELL_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'BetInHell',
        String(game.provider),
      );
    }
  }

  async handlePlayTechGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.PLAYTECH_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'PlayTech',
        String(game.provider),
      );
    }
  }

  async handlePopularGameSelection(ctx: any, callbackData: string) {
    const parts = callbackData.split('_');
    const gameId = parts[0];
    const game = this.POPULAR_GAMES.find((g) => g.id === gameId);
    if (game) {
      await this.handleGameSelection(
        ctx,
        callbackData,
        game.id,
        game.name,
        'Popular',
        String(game.provider),
      );
    }
  }

  async donate(ctx: any) {
    const text = `
<blockquote><b>💰 Пополнение баланса</b></blockquote>
<blockquote><b>• Минимальная сумма: 50 RUB</b></blockquote>
<blockquote><b>• Выберите сумму или введите свою
После выбора суммы, вы сможете выбрать способ оплаты</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
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
        [Markup.button.callback('🔙 Назад', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async depositCustom(ctx: any) {
    const userId = ctx.from.id;

    // Set user state to waiting for custom deposit amount
    this.userStates.set(userId, { state: 'awaiting_custom_deposit' });

    const text = `
<blockquote><b>💰 Введите сумму пополнения</b></blockquote>
<blockquote><b>• Минимальная сумма: 50 RUB</b></blockquote>
<blockquote><b>• Отправьте сообщением нужную сумму</b></blockquote>
<blockquote><b>• Только целое число</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async handleCustomDepositAmount(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    // Check if user is in the correct state
    if (!userState || userState.state !== 'awaiting_custom_deposit') {
      return false; // Not waiting for custom deposit
    }

    const messageText = ctx.message?.text?.trim();

    if (!messageText) {
      return false;
    }

    // Parse the amount
    const amount = Number(messageText);

    // Validate the amount
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 50) {
      await ctx.reply(
        '❌ Некорректная сумма. Пожалуйста, введите целое число не менее 50 RUB.',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад к пополнению', 'donate_menu')],
        ]),
      );
      return true;
    }

    // Clear the state
    this.clearUserState(userId);

    // Show payment methods for this amount
    const text = `
<blockquote><b>💰 Выберите способ оплаты</b></blockquote>
<blockquote><b>• Сумма: ${amount} RUB</b></blockquote>
<blockquote><b>• Выберите удобный способ оплаты</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_1.jpg');

    await ctx.replyWithPhoto(
      { source: fs.readFileSync(filePath) },
      {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('От 50р:', 'ignore_game')],
          [
            Markup.button.callback(
              '💎 CryptoBot',
              `paymentSystem_cryptobot_${amount}`,
            ),
            Markup.button.callback(
              '👛 FKwallet',
              `paymentSystem_fkwallet_${amount}`,
            ),
          ],
          [
            Markup.button.callback(
              '💳 Оплата с карты(+5% бонус)',
              `paymentSystem_yoomoney_${amount}`,
            ),
          ],
          [Markup.button.callback('От 50р до 2000р:', 'ignore_game')],
          [Markup.button.callback('📷 СБП', `paymentSystem_platega_${amount}`)],
          [Markup.button.callback('От 250р:', 'ignore_game')],
          [
            Markup.button.callback(
              '🛡 Криптовалюты',
              `paymentSystem_cryptocloud_${amount}`,
            ),
          ],
          [Markup.button.callback('От 500р до 100 000р', 'ignore_game')],
          [Markup.button.callback('💳 Карта', `paymentSystem_1plat_${amount}`)],
          [Markup.button.callback('⬅️ Назад', 'donate_menu')],
        ]).reply_markup,
      },
    );

    return true;
  }

  async depositAmount(ctx: any, amount: number) {
    const minAmount = 50;
    const valid = Number.isInteger(amount) && amount >= minAmount;

    const text = valid
      ? `\n<blockquote><b>💰 Выберите способ оплаты</b></blockquote>\n<blockquote><b>• Сумма: ${amount} RUB</b></blockquote>\n<blockquote><b>• Выберите удобный способ оплаты</b></blockquote>`
      : `\n<blockquote><b>❌ Минимальная сумма пополнения ${minAmount} RUB</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('От 50р:', 'ignore_all')],
        [
          Markup.button.callback(
            '💎 CryptoBot',
            `paymentSystem_cryptobot_${amount}`,
          ),
          Markup.button.callback(
            '👛 FKwallet',
            `paymentSystem_fkwallet_${amount}`,
          ),
        ],
        [
          Markup.button.callback(
            '💳 Оплата с карты(+5% бонус)',
            `paymentSystem_yoomoney_${amount}`,
          ),
        ],
        [Markup.button.callback('От 50р до 2000р:', 'ignore_all')],
        [Markup.button.callback('📷 СБП', `paymentSystem_platega_${amount}`)],
        [Markup.button.callback('От 250р:', 'ignore_all')],
        [
          Markup.button.callback(
            '🛡 Криптовалюты',
            `paymentSystem_cryptocloud_${amount}`,
          ),
        ],
        [Markup.button.callback('От 500р до 100 000р', 'ignore_all')],
        [Markup.button.callback('💳 Карта', `paymentSystem_1plat_${amount}`)],
        [Markup.button.callback('⬅️ Назад', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async profile(ctx: any) {
    const telegramId = String(ctx.from.id);
    const user = await this.userRepository.findOne({ telegramId });

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    // Get real user statistics
    const userStats = await this.statsService.getUserStats(user.id!);

    // Get bonus balance
    const bonusBalance = await this.balancesRepository.findOne({
      user,
      type: BalanceType.BONUS,
    });

    const text = `
<blockquote><b>📊 Статистика</b></blockquote>
<blockquote><b>🆔 ID:</b> <code>${telegramId}</code></blockquote>
<blockquote><b>🎮 Игр сыграно:</b> <code>${userStats.gamesPlayed}</code>
<b>🏆 Игр выиграно: ${userStats.gamesWon}</b></blockquote>
<blockquote><b>🎯 Винрейт: ${userStats.winrate}%</b>
 <b>🔥 Винстрик: ${userStats.winstreak} игр</b>
 <b>💥 Поражений подряд: ${userStats.losingStreak} игр</b></blockquote>
<blockquote><b>💰 Реально поставлено: ${userStats.actualBet.toFixed(2)} RUB</b>
<b>💵 Баланс: ${userStats.balance.toFixed(2)} RUB</b>
<b>🎁 Бонусный баланс: ${(bonusBalance?.balance || 0).toFixed(2)} RUB</b></blockquote>

`;

    const filePath = this.getImagePath('bik_bet_9.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('🔗 Реф. система', 'ignore_all'),
          Markup.button.callback('🔮 Ранг', 'ignore_all'),
        ],
        [Markup.button.callback('🎁 Мои бонусы', 'myBonuses')],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }
  async donateMenu(ctx: any) {
    const telegramId = String(ctx.from.id);
    const user = await this.userRepository.findOne({ telegramId });
    let balanceValue = 0;
    let bonusValue = 0;
    if (user) {
      // Get main balance
      const mainBalance = await this.balancesRepository.findOne(
        { user, type: BalanceType.MAIN },
        { populate: ['currency'] },
      );
      // Get bonus balance
      const bonusBalance = await this.balancesRepository.findOne(
        { user, type: BalanceType.BONUS },
        { populate: ['currency'] },
      );

      if (mainBalance) {
        balanceValue = mainBalance.balance ?? 0;
      }
      if (bonusBalance) {
        bonusValue = bonusBalance.balance ?? 0;
      }
    }
    const text = `
<blockquote><b>🆔 ID: <code>${telegramId}</code></b></blockquote>
<blockquote>💰 Баланс: <code>${balanceValue}</code> RUB</blockquote>
<blockquote> <b>🎁 Бонусный баланс:  <code>${bonusValue}</code> RUB</b> </blockquote>
`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('📥 Пополнить', 'donate'),
          Markup.button.callback('📤 Вывести', 'withdraw'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async withdraw(ctx: any) {
    const telegramId = String(ctx.from.id);
    const user = await this.userRepository.findOne({ telegramId });
    let balanceValue = 0;
    if (user) {
      const mainBalance = await this.balancesRepository.findOne({
        user,
        type: BalanceType.MAIN,
      });
      balanceValue = mainBalance?.balance ?? 0;
    }
    const text = `
<blockquote><b>💳 Вывод средств</b></blockquote>
<blockquote><b>💰 Доступно: ${balanceValue} RUB</b></blockquote>
<blockquote><b>• Минимальная сумма: 200 RUB
• Выберите сумму для вывода
• После выбора суммы выберите способ вывода</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('200 RUB', 'withdraw:200'),
          Markup.button.callback('500 RUB', 'withdraw:500'),
        ],
        [
          Markup.button.callback('1000 RUB', 'withdraw:1000'),
          Markup.button.callback('2500 RUB', 'withdraw:2500'),
        ],
        [Markup.button.callback('5000 RUB', 'withdraw:5000')],
        [Markup.button.callback('💰 Свой вариант', 'withdraw:custom')],
        [Markup.button.callback('🔙 Назад', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async withdrawAmount(ctx: any, amount: number) {
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['balances'] },
    );

    if (!user || !user.balances || user.balances.length === 0) {
      await ctx.answerCbQuery('⚠ Пользователь не найден. Нажмите /start', {
        show_alert: true,
      });
      return;
    }

    // Get the main balance
    const mainBalance = user.balances
      .getItems()
      .find((b) => b.type === BalanceType.MAIN);

    const balanceValue = mainBalance?.balance ?? 0;

    // Check minimum amount
    if (amount < 200) {
      await ctx.answerCbQuery('❌ Минимальная сумма вывода: 200 RUB', {
        show_alert: true,
      });
      return;
    }

    // Check if sufficient balance
    if (!mainBalance || mainBalance.balance < amount) {
      await ctx.answerCbQuery(
        '⚠ Недостаточно средств для вывода данной суммы',
      );
      return;
    }

    const text = `
<blockquote><b>💳 Вывод средств</b></blockquote>
<blockquote><b>💰 Сумма вывода: ${amount} RUB</b></blockquote>
<blockquote><b>• Выберите способ вывода</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('От 200р:', 'ignore_game')],
        [
          Markup.button.callback(
            '💎 CryptoBot',
            `withdrCrypto_cryptobot_${amount}`,
          ),
          Markup.button.callback(
            '👛 FKwallet',
            `withdrCrypto_fkwallet_${amount}`,
          ),
        ],
        [Markup.button.callback('От 500р:', 'ignore_game')],
        [
          Markup.button.callback(
            '🛡 USDT (trc-20)',
            `withdrCrypto_usdt20_${amount}`,
          ),
        ],
        [
          Markup.button.callback('💳 Карта', `withdrFiat_card_${amount}`),
          Markup.button.callback('💳 СБП', `withdrFiat_sbp_${amount}`),
        ],
        [Markup.button.callback('🔙 Назад', 'withdraw')],
      ]).reply_markup,
    });
  }

  async withdrawCustom(ctx: any) {
    const userId = ctx.from.id;

    // Set user state to waiting for custom withdraw amount
    this.userStates.set(userId, { state: 'awaiting_custom_withdraw' });

    const text = `
<blockquote><b>💰 Введите сумму вывода</b></blockquote>
<blockquote><b>• Минимальная сумма: 200 RUB</b></blockquote>
<blockquote><b>• Отправьте сообщением нужную сумму
• Только целое число
</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'withdraw')],
      ]).reply_markup,
    });
  }

  async handleForWithdrawText(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    if (!userState || !userState.state) {
      return false; // No active state
    }

    if (userState.state === 'awaiting_custom_withdraw') {
      await this.handleCustomWithdrawAmount(ctx);
      return true;
    }

    if (userState.state === 'awaiting_withdraw_fkwallet') {
      await this.handleWithdrawFKwalletRequisite(ctx);
      return true;
    }

    if (userState.state === 'awaiting_withdraw_card') {
      await this.handleWithdrawCardRequisite(ctx);
      return true;
    }

    if (userState.state === 'awaiting_withdraw_sbp') {
      await this.handleWithdrawSBPRequisite(ctx);
      return true;
    }

    if (userState.state === 'awaiting_reject_reason') {
      await this.handleRejectReason(ctx);
      return true;
    }

    return false; // Not handled
  }

  async handleCustomWithdrawAmount(ctx: any) {
    const userId = ctx.from.id;
    // Check if user is in the correct state
    const messageText = ctx.message?.text?.trim();
    if (!messageText) {
      return false;
    }

    // Check user balance first
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['balances'] },
    );

    if (!user || !user.balances || user.balances.length === 0) {
      await ctx.reply('⚠ Пользователь не найден. Нажмите /start');
      this.clearUserState(userId);
      return true;
    }

    // Get the main balance
    const mainBalance = user.balances
      .getItems()
      .find((b) => b.type === BalanceType.MAIN);
    const balanceValue = mainBalance?.balance ?? 0;

    // Parse the amount
    const amount = Number(messageText);

    // Validate the amount is a number and integer
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      await ctx.reply(
        '❌ Некорректная сумма. Пожалуйста, введите целое число не менее 200 RUB.',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад к выводу', 'withdraw')],
        ]),
      );
      return true;
    }

    // Check minimum amount
    if (amount < 200) {
      await ctx.reply('❌ Минимальная сумма вывода: 200 RUB');
      return true;
    }

    // Check if sufficient balance
    if (!mainBalance || mainBalance.balance < amount) {
      await ctx.reply('⚠ Недостаточно средств для вывода данной суммы');
      this.clearUserState(userId);
      return true;
    }

    // Clear the state
    this.clearUserState(userId);

    // Send new message with withdrawal method selection
    const text = `
<blockquote><b>💳 Вывод средств</b></blockquote>
<blockquote><b>💰 Сумма вывода: ${amount} RUB</b></blockquote>
<blockquote><b>• Выберите способ вывода</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_5.jpg');

    await ctx.replyWithPhoto(
      { source: fs.readFileSync(filePath) },
      {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('От 200р:', 'ignore_game')],
          [
            Markup.button.callback(
              '💎 CryptoBot',
              `withdrCrypto_cryptobot_${amount}`,
            ),
            Markup.button.callback(
              '👛 FKwallet',
              `withdrCrypto_fkwallet_${amount}`,
            ),
          ],
          [Markup.button.callback('От 500р:', 'ignore_game')],
          [
            Markup.button.callback(
              '🛡 USDT (trc-20)',
              `withdrCrypto_usdt20_${amount}`,
            ),
          ],
          [
            Markup.button.callback('💳 Карта', `withdrFiat_card_${amount}`),
            Markup.button.callback('💳 СБП', `withdrFiat_sbp_${amount}`),
          ],
          [Markup.button.callback('🔙 Назад', 'withdraw')],
        ]).reply_markup,
      },
    );

    return true;
  }

  async handleWithdrawFKwalletRequisite(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    // Check if user is in the correct state
    if (!userState || userState.state !== 'awaiting_withdraw_fkwallet') {
      const message = '⚠ Ошибка. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    const messageText = ctx.message?.text?.trim();

    if (!messageText) {
      return false;
    }

    const fkwalletId = messageText;
    const amount = userState.withdrawAmount!;
    const methodId = userState.withdrawMethodId!;

    // Get user from database with paymentPayoutRequisite relation
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      {
        telegramId,
      },
      {
        populate: ['paymentPayoutRequisite'],
      },
    );

    if (!user) {
      await ctx.reply('⚠ Пользователь не найден. Нажмите /start');
      this.clearUserState(userId);
      return true;
    }

    // Check if user has saved freekassa_id
    const hasSavedRequisite =
      user.paymentPayoutRequisite?.freekassa_id !== null &&
      user.paymentPayoutRequisite?.freekassa_id !== undefined;

    try {
      // Create payout request using PaymentService (same as payin)
      const withdrawal = await this.paymentService.payout({
        userId: user.id!,
        amount: amount,
        methodId: methodId,
        requisite: fkwalletId,
      });

      await this.sendMessageToAdminForWithdraw(
        ctx,
        withdrawal,
        'FKwallet',
        amount,
        fkwalletId,
      );

      // Clear the state
      this.clearUserState(userId);

      // Send success message
      const text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>
<blockquote><b>📝 Реквизит: <code>${fkwalletId}</code></b></blockquote>
<blockquote><b>⏳ Ожидайте обработки запроса.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_5.jpg');

      // Build inline keyboard buttons
      const buttons: any[] = [
        [
          Markup.button.url(
            '👨‍💻 Техническая поддержка',
            'https://t.me/bikbetsupport',
          ),
        ],
      ];

      buttons.push([
        Markup.button.callback(
          '💾 Сохранить реквизиты',
          `saveReq:FKwallet:${withdrawal.id}`,
        ),
      ]);

      buttons.push([
        Markup.button.callback('⬅️ Вернуться назад', 'donate_menu'),
      ]);

      await ctx.replyWithPhoto(
        { source: fs.readFileSync(filePath) },
        {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        },
      );

      return true;
    } catch (error) {
      console.log(error);

      this.clearUserState(userId);
      await ctx.reply('❌ Ошибка создания заявки на вывод. Попробуйте позже.');
      console.error('Withdraw FKwallet error:', error);
      return true;
    }
  }

  async fkwalletPayment(ctx: any, amount: number) {
    const uuid = crypto.randomInt(10000, 9999999);
    const text = `
<blockquote><b>🆔 ID депозита: ${uuid}</b></blockquote>
<blockquote><b>💰 Сумма к оплате: ${amount} RUB</b></blockquote>
<blockquote><b>📍 Для оплаты нажмите кнопку ниже</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne({ telegramId: telegramId });

    if (!user) {
      const message = '⚠ Пользователь не найден. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    try {
      // Create payment request using PaymentService
      const paymentResult = await this.paymentService.payin({
        userId: user.id!,
        amount: amount,
        methodId: 1, // FKwallet method ID
      });

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url('✅ Оплатить', paymentResult.paymentUrl)],
          [Markup.button.callback('🔙 Назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      const message = 'Создание платежа FK не удалось. Нажмите /start';
      await ctx.reply(message);
      return;
    }
  }

  async yoomoneyPayment(ctx: any, amount: number) {
    const uuid = crypto.randomInt(10000, 9999999);
    const text = `
<blockquote><b>🆔 ID депозита: ${uuid}</b></blockquote>
<blockquote><b>💰 Сумма к оплате: ${amount} RUB</b></blockquote>
<blockquote><b>📍 Для оплаты нажмите кнопку ниже</b></blockquote>
<blockquote><b>💳 Оплата с карты (+5% бонус)</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne({ telegramId: telegramId });

    if (!user) {
      const message = '⚠ Пользователь не найден. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    try {
      // Create payment request using PaymentService
      const paymentResult = await this.paymentService.payin({
        userId: user.id!,
        amount: amount,
        methodId: 2, // YooMoney method ID
      });

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url('✅ Оплатить', paymentResult.paymentUrl)],
          [Markup.button.callback('🔙 Назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      const message = 'Создание платежа YooMoney не удалось. Нажмите /start';
      await ctx.reply(message);
      return;
    }
  }

  async cryptobotPayment(ctx: any, amount: number) {
    const uuid = crypto.randomInt(10000, 9999999);
    const text = `
<blockquote><b>🆔 ID депозита: ${uuid}</b></blockquote>
<blockquote><b>💰 Сумма к оплате: ${amount} RUB</b></blockquote>
<blockquote><b>📍 Для оплаты нажмите кнопку ниже</b></blockquote>
<blockquote><b>💎 Оплата через CryptoBot</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne({ telegramId: telegramId });

    if (!user) {
      const message = '⚠ Пользователь не найден. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    try {
      // Create payment request using PaymentService
      const paymentResult = await this.paymentService.payin({
        userId: user.id!,
        amount: amount,
        methodId: 4, // CryptoBot method ID
      });

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url('✅ Оплатить', paymentResult.paymentUrl)],
          [Markup.button.callback('🔙 Назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      const message = 'Создание платежа CryptoBot не удалось. Нажмите /start';
      await ctx.reply(message);
      return;
    }
  }

  async plategaPayment(ctx: any, amount: number) {
    const uuid = crypto.randomInt(10000, 9999999);
    const text = `
<blockquote><b>🆔 ID депозита: ${uuid}</b></blockquote>
<blockquote><b>💰 Сумма к оплате: ${amount} RUB</b></blockquote>
<blockquote><b>📍 Для оплаты нажмите кнопку ниже или отсканируйте QR код</b></blockquote>
<blockquote><b>📷 Оплата через СБП (Platega)</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_1.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne({ telegramId: telegramId });

    if (!user) {
      const message = '⚠ Пользователь не найден. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    try {
      // Create payment request using PaymentService
      const paymentResult = await this.paymentService.payin({
        userId: user.id!,
        amount: amount,
        methodId: 5, // Platega method ID
      });

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url('✅ Оплатить', paymentResult.paymentUrl)],
          [Markup.button.callback('🔙 Назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      const message = 'Создание платежа Platega не удалось. Нажмите /start';
      await ctx.reply(message);
      return;
    }
  }

  async myBonuses(ctx: any) {
    try {
      const telegramId = String(ctx.from.id);
      const user = await this.userRepository.findOne({ telegramId });

      if (!user) {
        await ctx.reply('❌ Пользователь не найден');
        return;
      }

      // Get user's bonuses (last 10, ordered by creation date)
      const bonuses = await this.bonusesRepository.find(
        { user },
        {
          orderBy: { createdAt: 'DESC' },
          limit: 10,
        },
      );

      let text = `<blockquote><b>🎁 Мои бонусы</b></blockquote>\n`;

      text += `<blockquote><b>🟢 - Активный</b>\n`;
      text += `<b>🟠 - Не использован</b>\n`;
      text += `<b>🔴 - Использован</b></blockquote>\n\n`;

      text += `<blockquote><b>Показаны последние 10 бонусов</b></blockquote>\n`;
      text += `<blockquote><b>📍 Чтобы перейти к бонусу, нажмите на кнопку</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_6.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      // Create keyboard with bonus buttons and back button
      const keyboardButtons: any[] = [];

      if (bonuses.length > 0) {
        // Add bonus buttons
        bonuses.forEach((bonus) => {
          const statusEmoji = this.getBonusStatusEmoji(bonus.status);
          const amount = Math.round(parseFloat(bonus.amount));
          const date =
            bonus.createdAt?.toLocaleDateString('ru-RU') || 'Неизвестно';

          const buttonText = `${statusEmoji} ${amount} RUB (${date})`;
          const callbackData = `bonus_${bonus.id}`;

          keyboardButtons.push([
            Markup.button.callback(buttonText, callbackData),
          ]);
        });
      }

      // Add back button
      keyboardButtons.push([Markup.button.callback('⬅️ Назад', 'profile')]);

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard(keyboardButtons).reply_markup,
      });
    } catch (error) {
      console.error('Error fetching user bonuses:', error);
      await ctx.reply('❌ Ошибка при получении бонусов');
    }
  }

  /**
   * Handle bonus button click
   */
  async handleBonusClick(ctx: any, bonusId: number) {
    try {
      const telegramId = String(ctx.from.id);
      const user = await this.userRepository.findOne({ telegramId });

      if (!user) {
        await ctx.reply('❌ Пользователь не найден');
        return;
      }

      // Find the bonus
      const bonus = await this.bonusesRepository.findOne({
        id: bonusId,
        user: user,
      });

      if (!bonus) {
        await ctx.reply('❌ Бонус не найден');
        return;
      }

      // Check if bonus status is CREATED and change it to ISACTIVE
      if (bonus.status === BonusStatus.CREATED) {
        // Update bonus status to ISACTIVE
        bonus.status = BonusStatus.ISACTIVE;
        await this.em.persistAndFlush(bonus);

        // Add bonus to user's bonus balance
        const bonusBalance = await this.balancesRepository.findOne({
          user: user,
          type: BalanceType.BONUS,
        });

        if (bonusBalance) {
          const bonusAmount = parseFloat(bonus.amount);
          const startedAmount = bonusBalance.balance || 0;
          const finishedAmount = startedAmount + bonusAmount;

          // Update bonus balance
          bonusBalance.balance = finishedAmount;
          await this.em.persistAndFlush(bonusBalance);

          // Create balance history record
          const balanceHistory = this.balancesHistoryRepository.create({
            balance: bonusBalance,
            balanceBefore: startedAmount.toString(),
            amount: bonusAmount.toString(),
            balanceAfter: finishedAmount.toString(),
            description: `Bonus activation: ${Math.round(bonusAmount)} RUB`,
          });
          await this.em.persistAndFlush(balanceHistory);

          await ctx.reply(
            `✅ Бонус ${Math.round(bonusAmount)} RUB успешно активирован и добавлен на ваш бонусный баланс!`,
          );
        } else {
          await ctx.reply('❌ Ошибка: бонусный баланс не найден');
        }
      } else if (bonus.status === BonusStatus.ISACTIVE) {
        await ctx.reply(
          'ℹ️ Этот бонус уже активен и доступен для использования',
        );
      } else if (bonus.status === BonusStatus.FINISHED) {
        await ctx.reply('ℹ️ Этот бонус уже завершен');
      }

      // Refresh the bonuses list
      await this.myBonuses(ctx);
    } catch (error) {
      console.error('Error handling bonus click:', error);
      await ctx.reply('❌ Ошибка при обработке бонуса');
    }
  }

  /**
   * Get emoji for bonus status
   */
  private getBonusStatusEmoji(status: string): string {
    switch (status) {
      case BonusStatus.CREATED:
        return '🟠'; // Не использован
      case BonusStatus.ISACTIVE:
        return '🟢'; // Активный
      case BonusStatus.FINISHED:
        return '🔴'; // Использован
      default:
        return '🟠';
    }
  }

  /**
   * Get text for bonus status
   */
  private getBonusStatusText(status: string): string {
    switch (status) {
      case BonusStatus.CREATED:
        return 'Не использован';
      case BonusStatus.ISACTIVE:
        return 'Активный';
      case BonusStatus.FINISHED:
        return 'Использован';
      default:
        return 'Неизвестно';
    }
  }

  async info(ctx: any, channelLink: string) {
    const text = `<blockquote><b>🎰 <i><a href="${channelLink}">BikBet</a>! — передовая игровая платформа!</i></b></blockquote>
<blockquote><b>🎮 Доступные игры:
• 🎰 Настоящие слоты
• 🎲 Кости
• 💀 Черепа
• 🪙 Коинфлип
• 💣 Мины
• 🍭 Слот
• 🏀 Баскетбол
• ⚽️ Футбол
• 🎯 Дартс
• 🎳 Боулинг</b></blockquote>
<blockquote><b>💰 Минимальная сумма:
• Депозит: 50 RUB
• Вывод: 200 RUB</b></blockquote>
<blockquote><b><a href="${channelLink}">🎯 Честная игра и мгновенные выплаты только у нас!</a></b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_8.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.url(
            '👨‍💻 Техническая Поддержка',
            'https://t.me/bikbetsupport',
          ),
        ],
        [Markup.button.url('📰 Новости', channelLink)],
        [
          Markup.button.url(
            '📝 Правила',
            'https://teletype.in/@bikbetsupport/terms',
          ),
        ],

        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async bonuses(ctx: any) {
    const text = `<blockquote><b>🎁 Раздел "Бонусы" в Bik Bet</b></blockquote>
<blockquote>Здесь собраны все актуальные предложения:
💥 За активность
🎉 За участие в акциях
🎁 И просто так — в знак благодарности, что Вы с нами</blockquote>
<blockquote>На каждый бонус действует единое правило — отыгрыш x2 от суммы бонуса.
Но обратите внимание: условия получения и использования могут отличаться.</blockquote>
<blockquote>Проявляйте активность и активируйте как можно больше бонусов, чтобы играть с максимальной выгодой! 🚀</blockquote>`;

    const filePath = this.getImagePath('bik_bet_6.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('👑 VIP Клуб', 'vipClub')],
        [Markup.button.callback('🎡 Колесо фортуны', 'wheelInfo')],
        [Markup.button.callback('🎟 Промокоды', 'promosInfo')],
        [Markup.button.callback('💸 Кэшбек', 'cashbackInfo')],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async wheelInfo(ctx: any) {
    const text = `<blockquote><b>🎰 Добро пожаловать в колесо Фортуны! 🎰</b></blockquote>
<blockquote><b>🔥 Испытай удачу и забери свой куш!</b></blockquote>
<blockquote>Крути колесо и получи приятную сумму или даже крупный выигрыш — всё в твоих руках!</blockquote>
<blockquote><b>💎 Активируй Колесо Фортуны при сумме депозитов от 5000₽ за 30 дней и лови момент для большой победы!</b></blockquote>
<blockquote><b>🚀 Чем больше депозитов — тем ближе удача!</b></blockquote>
<blockquote>Крути, выигрывай, побеждай!</blockquote>
<blockquote><b>💡 Ваша текущая сумма депозитов — 0₽. Пора сделать шаг к удаче!</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_6.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'bonuses')],
      ]).reply_markup,
    });
  }

  async promosInfo(ctx: any) {
    const text = `<blockquote><b>🎁 Добро пожаловать в промокоды! 🎁</b></blockquote>
<blockquote>Здесь вы можете вводить актуальные промокоды с нашего канала и получать приятные бонусы на бонусный баланс.</blockquote>
<blockquote>Успейте активировать — лимит может закончиться в любой момент!</blockquote>
<blockquote><b>🚀 Следите за новостями и будьте первыми в очереди за бонусами!</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_6.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'bonuses')],
      ]).reply_markup,
    });
  }

  async cashbackInfo(ctx: any) {
    await ctx.answerCbQuery('⏳ В разработке');
  }

  async vipClub(ctx: any) {
    const text = `<blockquote><b>👑 VIP-Клуб</b></blockquote>
<blockquote>Ощутите VIP-опыт: быстрые выводы, персональные бонусы, закрытые акции и индивидуальная поддержка ждут вас 🫡</blockquote>
<blockquote><b>🏆 Чтобы попасть в приватный канал и получить все привилегии, необходимо сделать суммарный депозит 10 000₽ с момента запуска VIP-Клуба.</b></blockquote>
<blockquote><b>💎 Ваш текущий прогресс:</b></blockquote>
<blockquote>┗ 0.0₽ / 10 000₽ | 0%</blockquote>
<blockquote><b>🎁 Продолжайте пополнять счёт, чтобы открыть доступ к эксклюзивным бонусам, личному VIP менеджеру и закрытым ивентам!</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_11.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'bonuses')],
      ]).reply_markup,
    });
  }

  async leaderboardWins(ctx: any) {
    const leaderboardData = await this.statsService.getLeaderboardByWins();

    const entriesText = leaderboardData.entries
      .map(
        (entry) =>
          `<blockquote><b>${entry.medal} ${entry.rank}. - ${entry.username} | побед - ${entry.value}</b></blockquote>`,
      )
      .join('\n');

    const text = `<b>🏆 ${leaderboardData.title}</b>

${entriesText}

<i>${leaderboardData.footer}</i>`;

    const filePath = this.getImagePath('bik_bet_3.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏆 По победам', 'leaderboard_wins')],
        [
          Markup.button.callback('⚡️ По винстрику', 'leaderboard_winstreak'),
          Markup.button.callback('💥 По лузстрику', 'leaderboard_loosestrick'),
        ],
        [
          Markup.button.callback('🎲 По кол-ву игр', 'leaderboard_games'),
          Markup.button.callback('💰 По сумме ставок', 'leaderboard_bets'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async leaderboardWinstreak(ctx: any) {
    const leaderboardData = await this.statsService.getLeaderboardByWinstreak();

    const entriesText = leaderboardData.entries
      .map(
        (entry) =>
          `<blockquote><b>${entry.medal} ${entry.rank}. - ${entry.username} | винстрик - ${entry.value}</b></blockquote>`,
      )
      .join('\n');

    const text = `<b>🏆 ${leaderboardData.title}</b>

${entriesText}

<i>${leaderboardData.footer}</i>`;

    const filePath = this.getImagePath('bik_bet_3.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏆 По победам', 'leaderboard_wins')],
        [
          Markup.button.callback('⚡️ По винстрику', 'leaderboard_winstreak'),
          Markup.button.callback('💥 По лузстрику', 'leaderboard_loosestrick'),
        ],
        [
          Markup.button.callback('🎲 По кол-ву игр', 'leaderboard_games'),
          Markup.button.callback('💰 По сумме ставок', 'leaderboard_bets'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async leaderboardLoosestrick(ctx: any) {
    const leaderboardData =
      await this.statsService.getLeaderboardByLosingStreak();

    const entriesText = leaderboardData.entries
      .map(
        (entry) =>
          `<blockquote><b>${entry.medal} ${entry.rank}. - ${entry.username} | лузстрик - ${entry.value}</b></blockquote>`,
      )
      .join('\n');

    const text = `<b>🏆 ${leaderboardData.title}</b>

${entriesText}

<i>${leaderboardData.footer}</i>`;

    const filePath = this.getImagePath('bik_bet_3.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏆 По победам', 'leaderboard_wins')],
        [
          Markup.button.callback('⚡️ По винстрику', 'leaderboard_winstreak'),
          Markup.button.callback('💥 По лузстрику', 'leaderboard_loosestrick'),
        ],
        [
          Markup.button.callback('🎲 По кол-ву игр', 'leaderboard_games'),
          Markup.button.callback('💰 По сумме ставок', 'leaderboard_bets'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async leaderboardGames(ctx: any) {
    const leaderboardData = await this.statsService.getLeaderboardByGames();

    const entriesText = leaderboardData.entries
      .map(
        (entry) =>
          `<blockquote><b>${entry.medal} ${entry.rank}. - ${entry.username} | игр - ${entry.value}</b></blockquote>`,
      )
      .join('\n');

    const text = `<b>🏆 ${leaderboardData.title}</b>

${entriesText}

<i>${leaderboardData.footer}</i>`;

    const filePath = this.getImagePath('bik_bet_3.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏆 По победам', 'leaderboard_wins')],
        [
          Markup.button.callback('⚡️ По винстрику', 'leaderboard_winstreak'),
          Markup.button.callback('💥 По лузстрику', 'leaderboard_loosestrick'),
        ],
        [
          Markup.button.callback('🎲 По кол-ву игр', 'leaderboard_games'),
          Markup.button.callback('💰 По сумме ставок', 'leaderboard_bets'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async leaderboardBets(ctx: any) {
    const leaderboardData = await this.statsService.getLeaderboardByBets();

    const entriesText = leaderboardData.entries
      .map(
        (entry) =>
          `<blockquote><b>${entry.medal} ${entry.rank}. - ${entry.username} | ставок на ${entry.value.toFixed(2)} RUB</b></blockquote>`,
      )
      .join('\n');

    const text = `<b>🏆 ${leaderboardData.title}</b>

${entriesText}

<i>${leaderboardData.footer}</i>`;

    const filePath = this.getImagePath('bik_bet_3.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏆 По победам', 'leaderboard_wins')],
        [
          Markup.button.callback('⚡️ По винстрику', 'leaderboard_winstreak'),
          Markup.button.callback('💥 По лузстрику', 'leaderboard_loosestrick'),
        ],
        [
          Markup.button.callback('🎲 По кол-ву игр', 'leaderboard_games'),
          Markup.button.callback('💰 По сумме ставок', 'leaderboard_bets'),
        ],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async withdrawCryptoBot(ctx: any, amount: number) {
    const userId = ctx.from.id;

    // Set user state with withdrawal info
    this.userStates.set(userId, {
      withdrawAmount: amount,
      withdrawMethod: 'CryptoBot',
      withdrawMethodId: 4, // CryptoBot method ID
    });

    let text = `
<blockquote><b>Сумма вывода: <code>${amount}</code> RUB</b></blockquote>
<blockquote><b>Метод: CryptoBot 💎</b></blockquote>
<blockquote><b>Вы уверены?</b></blockquote>`;

    const buttons: any[] = [];

    // Add confirmation buttons
    buttons.push([Markup.button.callback('✅ Подтвердить', 'kb_accept')]);
    buttons.push([Markup.button.callback('❌ Отменить', 'kb_reject')]);

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  }

  async handleCryptoBotAccept(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    if (!userState || !userState.withdrawAmount) {
      await ctx.answerCbQuery('⚠ Ошибка. Начните сначала', {
        show_alert: true,
      });
      return;
    }

    const amount = userState.withdrawAmount;
    const methodId = userState.withdrawMethodId!;

    // Get user from database
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      {
        telegramId,
      },
      {
        populate: ['paymentPayoutRequisite'],
      },
    );

    if (!user) {
      await ctx.reply('⚠ Пользователь не найден. Нажмите /start');
      this.clearUserState(userId);
      return;
    }

    // Use user's Telegram ID as the requisite for CryptoBot
    const cryptobotRequisite = telegramId;

    try {
      // Create payout request using PaymentService (creates CryptoBot check)
      const withdrawal = await this.paymentService.payout({
        userId: user.id!,
        amount: amount,
        methodId: methodId,
        requisite: cryptobotRequisite,
      });

      // Clear the state
      this.clearUserState(userId);

      // Check if we got a check URL from the response
      const checkUrl = withdrawal?.check_url || withdrawal?.requisite;
      const amountUsdt = withdrawal?.amount_usdt || 'N/A';

      // Build success message - Similar to Python code
      let text = '';
      if (checkUrl) {
        // If check URL is available, show it to user (like Python code)
        text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code> (${amountUsdt} USDT)</b></blockquote>
<blockquote><b>💎 <a href='${checkUrl}'>Получить выплату (CryptoBot)</a></b></blockquote>
<blockquote><b>✅ Вывод готов! Нажмите на ссылку выше для получения.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;
      } else {
        // Fallback if no check URL
        text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>
<blockquote><b>⏳ Ожидайте обработки запроса.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;
      }

      // Send admin notification with check URL
      await this.sendMessageToAdminForWithdraw(
        ctx,
        withdrawal,
        'CryptoBot',
        amount,
        checkUrl || cryptobotRequisite,
      );

      const filePath = this.getImagePath('bik_bet_5.jpg');

      // Build inline keyboard buttons
      const buttons: any[] = [
        [
          Markup.button.url(
            '👨‍💻 Техническая поддержка',
            'https://t.me/bikbetsupport',
          ),
        ],
      ];

      buttons.push([
        Markup.button.callback('⬅️ Вернуться назад', 'donate_menu'),
      ]);

      await ctx.replyWithPhoto(
        { source: fs.readFileSync(filePath) },
        {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        },
      );

      return true;
    } catch (error) {
      console.log(error);

      this.clearUserState(userId);

      // Check for specific CryptoBot errors
      const errorMessage = error?.message || '';
      let userMessage = '❌ Ошибка создания заявки на вывод. Попробуйте позже.';

      if (errorMessage.includes('NOT_ENOUGH_COINS')) {
        userMessage =
          '⚠️ Временно недоступно.\n' +
          'Сервис CryptoBot пополняется. Попробуйте позже или выберите другой способ вывода.\n\n' +
          '💰 Ваш баланс был возвращен.';
      } else if (errorMessage.includes('INSUFFICIENT_FUNDS')) {
        userMessage =
          '⚠️ Временно недоступно.\n' +
          'Недостаточно средств для вывода. Попробуйте позже.\n\n' +
          '💰 Ваш баланс был возвращен.';
      } else if (errorMessage.includes('USER_NOT_FOUND')) {
        userMessage =
          '❌ Ошибка: пользователь не найден в CryptoBot.\n' +
          'Убедитесь, что вы начали диалог с @CryptoBot.\n\n' +
          '💰 Ваш баланс был возвращен.';
      }

      await ctx.reply(userMessage);
      console.error('Withdraw CryptoBot error:', error);
      return true;
    }
  }

  async handleCryptoBotReject(ctx: any) {
    const userId = ctx.from.id;

    // Clear the state
    this.clearUserState(userId);

    const text = `<blockquote><b>❌ Действие было отменено!</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к выводу', 'withdraw')],
      ]).reply_markup,
    });
  }

  async saveWithdrawRequisite(ctx: any, method: string, withdrawalId: string) {
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['paymentPayoutRequisite'] },
    );

    if (!user) {
      await ctx.answerCbQuery('⚠ Пользователь не найден. Нажмите /start', {
        show_alert: true,
      });
      return;
    }

    try {
      // Get the withdrawal to fetch the requisite
      const withdrawal = await this.paymentService.getTransaction(
        Number(withdrawalId),
      );

      if (!withdrawal || !withdrawal.requisite) {
        await ctx.answerCbQuery('❌ Не удалось получить реквизиты', {
          show_alert: true,
        });
        return;
      }

      const requisite = withdrawal.requisite;

      let payoutRequisite = user.paymentPayoutRequisite;

      if (!payoutRequisite) {
        // Create new requisite record
        payoutRequisite = this.paymentPayoutRequisiteRepository.create({
          user: user,
        });
      }

      // Save based on method
      if (method === 'FKwallet') {
        payoutRequisite.freekassa_id = requisite;
      } else if (method === 'Card') {
        payoutRequisite.card = requisite;
      } else if (method === 'SBP') {
        payoutRequisite.sbp = requisite;
      }

      await this.em.persistAndFlush(payoutRequisite);

      await ctx.answerCbQuery('✅ Реквизиты сохранены!', {
        show_alert: true,
      });

      // Update the message to remove the save button
      const text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💰 Сумма вывода сохранена</b></blockquote>
<blockquote><b>💎 Метод: ${method}</b></blockquote>
<blockquote><b>📝 Реквизит: <code>${requisite}</code></b></blockquote>
<blockquote><b>💾 Реквизиты сохранены для будущих выводов</b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_5.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.url(
              '👨‍💻 Техническая поддержка',
              'https://t.me/bikbetsupport',
            ),
          ],
          [Markup.button.callback('⬅️ Вернуться назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      console.error('Save requisite error:', error);
      await ctx.answerCbQuery('❌ Ошибка сохранения реквизитов', {
        show_alert: true,
      });
    }
  }

  async useSavedWithdrawRequisite(ctx: any, method: string, amount: number) {
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['paymentPayoutRequisite'] },
    );

    if (!user) {
      await ctx.answerCbQuery('⚠ Пользователь не найден. Нажмите /start', {
        show_alert: true,
      });
      return;
    }

    // Get saved requisite from database
    let requisite: string | undefined;
    if (method === 'FKwallet') {
      requisite = user.paymentPayoutRequisite?.freekassa_id;
    } else if (method === 'Card') {
      requisite = user.paymentPayoutRequisite?.card;
    } else if (method === 'SBP') {
      requisite = user.paymentPayoutRequisite?.sbp;
    }

    if (!requisite) {
      await ctx.answerCbQuery('❌ Сохранённый реквизит не найден', {
        show_alert: true,
      });
      return;
    }

    try {
      // Determine methodId based on payment method
      let methodId = 1; // Default to FKwallet
      if (method === 'FKwallet') {
        methodId = 1;
      } else if (method === 'CryptoBot') {
        methodId = 4;
      } else if (method === 'Card' || method === 'SBP') {
        methodId = 5; // Platega
      }

      // Determine payment type params for Platega
      const params: any = {};
      if (method === 'Card') {
        params.paymentType = 'card';
      } else if (method === 'SBP') {
        params.paymentType = 'sbp';
      }

      // Create payout request using PaymentService
      const withdrawal = await this.paymentService.payout({
        userId: user.id!,
        amount: amount,
        methodId: methodId,
        requisite: requisite,
        params: Object.keys(params).length > 0 ? params : undefined,
      });

      await this.sendMessageToAdminForWithdraw(
        ctx,
        withdrawal,
        method,
        amount,
        requisite,
      );

      await ctx.answerCbQuery('✅ Используется сохранённый реквизит');

      // Send success message
      const text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>
<blockquote><b>📝 Реквизит: <code>${requisite}</code></b></blockquote>
<blockquote><b>💾 Использован сохранённый реквизит</b></blockquote>
<blockquote><b>⏳ Ожидайте обработки запроса.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_5.jpg');
      const media: any = {
        type: 'photo',
        media: { source: fs.readFileSync(filePath) },
        caption: text,
        parse_mode: 'HTML',
      };

      await ctx.editMessageMedia(media, {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.url(
              '👨‍💻 Техническая поддержка',
              'https://t.me/bikbetsupport',
            ),
          ],
          [Markup.button.callback('⬅️ Вернуться назад', 'donate_menu')],
        ]).reply_markup,
      });
    } catch (error) {
      console.error('Use saved requisite error:', error);
      await ctx.answerCbQuery('❌ Ошибка создания заявки на вывод', {
        show_alert: true,
      });
    }
  }

  async sendMessageToAdminForWithdraw(
    ctx: any,
    withdrawal: any,
    method: string,
    amount: number,
    requisite: string,
  ) {
    // Check if withdrawal has check URL (for CryptoBot)
    const checkUrl = withdrawal?.check_url;
    const amountUsdt = withdrawal?.amount_usdt;

    // Format the message - similar to Python code
    let message = '';
    if (method === 'CryptoBot' && checkUrl) {
      // Special format for CryptoBot with check URL
      message =
        `<blockquote><b>🔹 Новый запрос на вывод 🔹</b></blockquote>\n` +
        `<blockquote><b>🛡 Метод: <code>${method}</code>🔹</b></blockquote>\n` +
        `<blockquote><b>📌 ID запроса: <code>№${withdrawal.id}</code></b></blockquote>\n` +
        `<blockquote><b>👤 Пользователь: <code>${ctx.from.id}</code></b></blockquote>\n` +
        `<blockquote><b>💰 Сумма: <code>${amount} RUB</code> (${amountUsdt} USDT)</b></blockquote>\n` +
        `<blockquote><b>💎 Check URL: <a href='${checkUrl}'>Открыть чек</a></b></blockquote>\n`;
    } else {
      // Standard format for other methods
      message =
        `<blockquote><b>🔹 Новый запрос на вывод 🔹</b></blockquote>\n` +
        `<blockquote><b>🛡 Метод: <code>${method}</code>🔹</b></blockquote>\n` +
        `<blockquote><b>📌 ID запроса: <code>№${withdrawal.id}</code></b></blockquote>\n` +
        `<blockquote><b>👤 Пользователь: <code>${ctx.from.id}</code></b></blockquote>\n` +
        `<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>\n` +
        `<blockquote><b>💳 Реквизиты:\n` +
        `<code>${requisite}\n</code></b></blockquote>`;
    }

    // Send message to Telegram
    await ctx.telegram.sendMessage(
      this.chatIdForDepositsAndWithdrawals,
      message,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Выполнено',
                callback_data: `withdraw_${withdrawal.id}_approve_${method}`,
              },
              {
                text: '❌ Отклонить',
                callback_data: `withdraw_${withdrawal.id}_reject_${method}`,
              },
            ],
            [
              {
                text: '👾 История игр',
                callback_data: `gameDump_${ctx.from.id}`,
              },
            ],
            [
              {
                text: '📨 Написать',
                url: `tg://user?id=${ctx.from.id}`,
              },
            ],
          ],
        },
      },
    );
  }

  async withdrawFKwallet(ctx: any, amount: number) {
    const userId = ctx.from.id;

    // Get user with saved requisites
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['paymentPayoutRequisite'] },
    );

    // Set user state to waiting for FKwallet ID
    this.userStates.set(userId, {
      state: 'awaiting_withdraw_fkwallet',
      withdrawAmount: amount,
      withdrawMethod: 'FKwallet',
      withdrawMethodId: 1, // FKwallet method ID
    });

    const savedFKwalletId = user?.paymentPayoutRequisite?.freekassa_id;

    let text = `
<blockquote><b>Сумма вывода: <code>${amount}</code>  RUB</b></blockquote>
<blockquote><b>Метод: FKwallet 💎</b></blockquote>
<blockquote><b>Отправьте свой аккаунт в следующем формате:</b></blockquote>
<blockquote><b>F8202583610562856</b></blockquote>
<blockquote><b>Либо выберите сохранённый реквизит ниже:</b></blockquote>`;

    const buttons: any[] = [];

    // If user has saved FKwallet ID, show it as a button
    if (savedFKwalletId) {
      buttons.push([
        Markup.button.callback(
          ` ${savedFKwalletId}`,
          `useSavedReq:FKwallet:${amount}`,
        ),
      ]);
    }

    buttons.push([Markup.button.callback('🔙 Назад', 'withdraw')]);

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  }

  async withdrawUSDT20(ctx: any, amount: number) {
    const text = `
<blockquote><b>🛡 Вывод USDT (trc-20)</b></blockquote>
<blockquote><b>💰 Сумма вывода: ${amount} RUB</b></blockquote>
<blockquote><b>📝 Введите ваш USDT (trc-20) адрес для вывода</b></blockquote>`;

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'withdraw')],
      ]).reply_markup,
    });
  }

  async handleWithdrawCardRequisite(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    // Check if user is in the correct state
    if (!userState || userState.state !== 'awaiting_withdraw_card') {
      const message = '⚠ Ошибка. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    const messageText = ctx.message?.text?.trim();

    if (!messageText) {
      return false;
    }

    // Parse input: "2222333344445555 Игнат А. Сбербанк"
    // Extract card number (first 16 digits), name, and bank
    const parts = messageText.split(/\s+/);
    const cardNumber = parts[0].replace(/\D/g, ''); // Remove non-digits
    const holderName = parts.slice(1, -1).join(' ') || ''; // Name (middle parts)
    const bankName = parts[parts.length - 1] || ''; // Bank (last part)

    // Validate card number (16 digits)
    if (!/^\d{16}$/.test(cardNumber)) {
      await ctx.reply(
        '❌ Некорректный номер карты. Введите 16 цифр карты, затем имя и банк.\nПример: 2222333344445555 Игнат А. Сбербанк',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад к выводу', 'withdraw')],
        ]),
      );
      return true;
    }

    // Combine full requisite for admin and storage
    const fullRequisite = `${cardNumber} ${holderName} ${bankName}`.trim();

    const amount = userState.withdrawAmount!;
    const methodId = userState.withdrawMethodId!;

    // Get user from database
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      {
        telegramId,
      },
      {
        populate: ['paymentPayoutRequisite'],
      },
    );

    if (!user) {
      await ctx.reply('⚠ Пользователь не найден. Нажмите /start');
      this.clearUserState(userId);
      return true;
    }

    try {
      // Create payout request using PaymentService with Platega
      const withdrawal = await this.paymentService.payout({
        userId: user.id!,
        amount: amount,
        methodId: methodId,
        requisite: fullRequisite,
        params: { paymentType: 'card' },
      });

      await this.sendMessageToAdminForWithdraw(
        ctx,
        withdrawal,
        'Card',
        amount,
        fullRequisite,
      );

      // Clear the state
      this.clearUserState(userId);

      // Send success message
      const maskedCard =
        cardNumber.substring(0, 4) + ' **** **** ' + cardNumber.substring(12);
      const displayRequisite = `${maskedCard} ${holderName} ${bankName}`.trim();
      const text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>
<blockquote><b>📝 Карта: <code>${displayRequisite}</code></b></blockquote>
<blockquote><b>⏳ Ожидайте обработки запроса.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_5.jpg');

      // Build inline keyboard buttons
      const buttons: any[] = [
        [
          Markup.button.url(
            '👨‍💻 Техническая поддержка',
            'https://t.me/bikbetsupport',
          ),
        ],
      ];

      // Use withdrawal ID for callback to avoid length issues
      buttons.push([
        Markup.button.callback(
          '💾 Сохранить реквизиты',
          `saveReq:Card:${withdrawal.id}`,
        ),
      ]);

      buttons.push([
        Markup.button.callback('⬅️ Вернуться назад', 'donate_menu'),
      ]);

      await ctx.replyWithPhoto(
        { source: fs.readFileSync(filePath) },
        {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        },
      );

      return true;
    } catch (error) {
      console.log(error);

      this.clearUserState(userId);
      await ctx.reply('❌ Ошибка создания заявки на вывод. Попробуйте позже.');
      console.error('Withdraw Card error:', error);
      return true;
    }
  }

  async handleWithdrawSBPRequisite(ctx: any) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    // Check if user is in the correct state
    if (!userState || userState.state !== 'awaiting_withdraw_sbp') {
      const message = '⚠ Ошибка. Нажмите /start';
      await ctx.reply(message);
      return;
    }

    const messageText = ctx.message?.text?.trim();

    if (!messageText) {
      return false;
    }

    // Parse input: "+79004006090 Игнат А. Сбербанк"
    // Extract phone, name, and bank
    const parts = messageText.split(/\s+/);
    let phoneNumber = parts[0].replace(/[\s\-\(\)]/g, '');
    const holderName = parts.slice(1, -1).join(' ') || ''; // Name (middle parts)
    const bankName = parts[parts.length - 1] || ''; // Bank (last part)

    // Normalize phone number
    if (phoneNumber.startsWith('+7')) {
      phoneNumber = phoneNumber.substring(2);
    } else if (phoneNumber.startsWith('7')) {
      phoneNumber = phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('8')) {
      phoneNumber = phoneNumber.substring(1);
    }

    // Validate phone number
    if (!/^\d{10}$/.test(phoneNumber)) {
      await ctx.reply(
        '❌ Некорректный номер телефона. Введите номер, имя и банк.\nПример: +79004006090 Игнат А. Сбербанк',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад к выводу', 'withdraw')],
        ]),
      );
      return true;
    }

    // Add +7 prefix for full phone number
    const fullPhoneNumber = '+7' + phoneNumber;

    // Combine full requisite for admin and storage
    const fullRequisite = `${fullPhoneNumber} ${holderName} ${bankName}`.trim();

    const amount = userState.withdrawAmount!;
    const methodId = userState.withdrawMethodId!;

    // Get user from database
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      {
        telegramId,
      },
      {
        populate: ['paymentPayoutRequisite'],
      },
    );

    if (!user) {
      await ctx.reply('⚠ Пользователь не найден. Нажмите /start');
      this.clearUserState(userId);
      return true;
    }

    try {
      // Create payout request using PaymentService with Platega
      const withdrawal = await this.paymentService.payout({
        userId: user.id!,
        amount: amount,
        methodId: methodId,
        requisite: fullRequisite,
        params: { paymentType: 'sbp' },
      });

      await this.sendMessageToAdminForWithdraw(
        ctx,
        withdrawal,
        'SBP',
        amount,
        fullRequisite,
      );

      // Clear the state
      this.clearUserState(userId);

      // Send success message
      const text = `
<blockquote><b>✅ Заявка на вывод создана!</b></blockquote>
<blockquote><b>💳 ID Вывода: <code>№${withdrawal.id}</code></b></blockquote>
<blockquote><b>💰 Сумма: <code>${amount} RUB</code></b></blockquote>
<blockquote><b>📝 Реквизиты: <code>${fullRequisite}</code></b></blockquote>
<blockquote><b>⏳ Ожидайте обработки запроса.\n <a href='https://t.me/bikbetofficial'>C уважением BikBet!</a></b></blockquote>`;

      const filePath = this.getImagePath('bik_bet_5.jpg');

      // Build inline keyboard buttons
      const buttons: any[] = [
        [
          Markup.button.url(
            '👨‍💻 Техническая поддержка',
            'https://t.me/bikbetsupport',
          ),
        ],
      ];

      // Use withdrawal ID for callback to avoid length issues
      buttons.push([
        Markup.button.callback(
          '💾 Сохранить реквизиты',
          `saveReq:SBP:${withdrawal.id}`,
        ),
      ]);

      buttons.push([
        Markup.button.callback('⬅️ Вернуться назад', 'donate_menu'),
      ]);

      await ctx.replyWithPhoto(
        { source: fs.readFileSync(filePath) },
        {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        },
      );

      return true;
    } catch (error) {
      console.log(error);

      this.clearUserState(userId);
      await ctx.reply('❌ Ошибка создания заявки на вывод. Попробуйте позже.');
      console.error('Withdraw SBP error:', error);
      return true;
    }
  }

  async withdrawCard(ctx: any, amount: number) {
    const userId = ctx.from.id;

    // Get user with saved requisites
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['paymentPayoutRequisite'] },
    );

    // Set user state to waiting for card number
    this.userStates.set(userId, {
      state: 'awaiting_withdraw_card',
      withdrawAmount: amount,
      withdrawMethod: 'Card',
      withdrawMethodId: 5, // Platega method ID
    });

    const savedCardNumber = user?.paymentPayoutRequisite?.card;

    let text = `
<blockquote><b>Сумма вывода: <code>${amount}</code> RUB</b></blockquote>
<blockquote><b>Метод: Карта 💳</b></blockquote>
<blockquote><b>Отправьте номер карты в следующем формате:</b></blockquote>
<blockquote><b>2222333344445555 Игнат А. Сбербанк</b></blockquote>
<blockquote><b>Либо выберите сохранённый реквизит ниже:</b></blockquote>`;

    const buttons: any[] = [];

    // If user has saved card requisite, show it as a button
    if (savedCardNumber) {
      // Extract just the card number if it has additional info
      const cardDigits = savedCardNumber.replace(/\D/g, '').substring(0, 16);
      const maskedCard =
        cardDigits.substring(0, 4) + ' **** **** ' + cardDigits.substring(12);
      buttons.push([
        Markup.button.callback(
          `💳 ${maskedCard}`,
          `useSavedReq:Card:${amount}`,
        ),
      ]);
    }

    buttons.push([Markup.button.callback('🔙 Назад', 'withdraw')]);

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  }

  async handleWithdrawReject(ctx: any, withdrawalId: number, method: string) {
    try {
      // Get transaction details
      const withdrawal = await this.paymentService.getTransaction(withdrawalId);

      if (!withdrawal) {
        await ctx.answerCbQuery('❌ Транзакция не найдена', {
          show_alert: true,
        });
        return;
      }

      const adminId = ctx.from.id;
      const userTgId = withdrawal.user?.telegramId || 'Unknown';
      const amount = withdrawal.amount;

      await ctx.answerCbQuery();

      // Update the admin message to show rejection info
      const text = `
<blockquote>❌ Запрос на вывод отклонен.</blockquote>
<blockquote>📌 <b>ID запроса: </b><code>№${withdrawalId}</code></blockquote>
<blockquote>💳 <b>Метод: </b><code>${method}</code></blockquote>
<blockquote><b>👤 Пользователь:</b> <code>${userTgId}</code></blockquote>
<blockquote><b>💰 Сумма:</b> <code>${Math.floor(amount)} RUB</code></blockquote>

`;

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
      });

      // Ask admin for rejection reason
      const reasonMsg = await ctx.reply(
        '<blockquote>📝 Укажите причину отказа в выводе:</blockquote>',
        { parse_mode: 'HTML' },
      );

      // Store rejection data in state
      this.userStates.set(adminId, {
        state: 'awaiting_reject_reason',
        rejectionData: {
          withdrawalId,
          method,
          adminId,
          messageId: reasonMsg.message_id,
          userTgId: parseInt(userTgId),
          amount,
        },
      });
    } catch (error) {
      console.error('Withdraw reject error:', error);
      await ctx.answerCbQuery('❌ Ошибка отклонения запроса', {
        show_alert: true,
      });
    }
  }

  async handleRejectReason(ctx: any) {
    const adminId = ctx.from.id;
    const userState = this.userStates.get(adminId);

    // Check if admin is in the correct state
    if (!userState || userState.state !== 'awaiting_reject_reason') {
      return false; // Not waiting for reject reason
    }

    const reason = ctx.message?.text?.trim();

    if (!reason) {
      return false;
    }

    const rejectionData = userState.rejectionData!;

    try {
      // Reject payout in finance service (refunds balance)
      await this.paymentService.rejectPayout(rejectionData.withdrawalId);

      // Send message to user
      await ctx.telegram.sendMessage(
        rejectionData.userTgId,
        `
<blockquote>❌ Ваш запрос №${rejectionData.withdrawalId} на вывод ${Math.floor(rejectionData.amount)} RUB отклонен.</blockquote>
<blockquote>💰 Средства возвращены на баланс.</blockquote>

<blockquote>💬 Причина:</blockquote>
<blockquote>${reason}</blockquote>
`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🏠 Главное меню',
                  callback_data: 'start',
                },
              ],
            ],
          },
        },
      );

      // Delete the reason request message
      await ctx.telegram.deleteMessage(ctx.chat.id, rejectionData.messageId);
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);

      // Send confirmation to admin
      await ctx.reply(
        `<blockquote>Заявка на вывод №${rejectionData.withdrawalId} успешно отклонена</blockquote>\n\n<blockquote>💬 Причина:</blockquote>\n<blockquote>${reason}</blockquote>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ Удалить',
                  callback_data: 'removeMSG',
                },
              ],
            ],
          },
        },
      );

      // Clear state
      this.clearUserState(adminId);

      return true;
    } catch (error) {
      console.error('Reject reason processing error:', error);
      await ctx.reply('❌ Ошибка обработки отклонения');
      this.clearUserState(adminId);
      return true;
    }
  }

  async withdrawSBP(ctx: any, amount: number) {
    const userId = ctx.from.id;

    // Get user with saved requisites
    const telegramId = String(ctx.from.id);
    let user = await this.userRepository.findOne(
      { telegramId },
      { populate: ['paymentPayoutRequisite'] },
    );

    // Set user state to waiting for phone number
    this.userStates.set(userId, {
      state: 'awaiting_withdraw_sbp',
      withdrawAmount: amount,
      withdrawMethod: 'SBP',
      withdrawMethodId: 5, // Platega method ID
    });

    const savedPhone = user?.paymentPayoutRequisite?.sbp;

    let text = `
<blockquote><b>Сумма вывода: <code>${amount}</code> RUB</b></blockquote>
<blockquote><b>Метод: СБП 💳</b></blockquote>
<blockquote><b>Отправьте номер телефона в следующем формате:</b></blockquote>
<blockquote><b>+79004006090 Игнат А. Сбербанк</b></blockquote>
<blockquote><b>Либо выберите сохранённый реквизит ниже:</b></blockquote>`;

    const buttons: any[] = [];

    // If user has saved phone number, show it as a button
    if (savedPhone) {
      // Extract just the phone number if it has additional info
      const phoneMatch = savedPhone.match(/\+?\d+/);
      const displayPhone = phoneMatch ? phoneMatch[0] : savedPhone;
      buttons.push([
        Markup.button.callback(
          `📱 ${displayPhone}`,
          `useSavedReq:SBP:${amount}`,
        ),
      ]);
    }

    buttons.push([Markup.button.callback('🔙 Назад', 'withdraw')]);

    const filePath = this.getImagePath('bik_bet_5.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  }

  /**
   * Initialize periodic cleanup on module start
   */
  onModuleInit() {
    this.logger.log('Initializing periodic memory cleanup');

    // Run cleanup every 15 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.performMemoryCleanup();
      },
      15 * 60 * 1000,
    );

    // Run initial cleanup after 5 minutes
    setTimeout(
      () => {
        this.performMemoryCleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Clean up interval on module destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.log('Cleanup interval cleared');
    }
  }

  /**
   * Perform memory cleanup operations
   */
  private performMemoryCleanup() {
    const before = {
      userStates: this.userStates.size,
      currentPage: this.currentPage.size,
      lastMessageId: this.lastMessageId.size,
      heapUsed: process.memoryUsage().heapUsed,
    };

    // Clean up entries older than 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.currentPage.cleanupOlderThan(ONE_DAY);
    this.lastMessageId.cleanupOlderThan(ONE_DAY);

    // Warn if userStates gets too large (possible leak)
    if (this.userStates.size > 5000) {
      this.logger.warn(
        `userStates size is ${this.userStates.size}, possible leak!`,
      );
    }

    // Clear MikroORM entity manager to free entity references
    try {
      this.em.clear();
    } catch (error) {
      this.logger.error('Error clearing entity manager:', error);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const after = {
      userStates: this.userStates.size,
      currentPage: this.currentPage.size,
      lastMessageId: this.lastMessageId.size,
      heapUsed: process.memoryUsage().heapUsed,
    };

    const heapReduction = (before.heapUsed - after.heapUsed) / 1024 / 1024;

    this.logger.log('Memory cleanup completed', {
      before,
      after,
      heapReductionMB: heapReduction.toFixed(2),
    });
  }

  /**
   * Get memory statistics for monitoring
   */
  public getMemoryStats() {
    return {
      maps: {
        userStates: this.userStates.size,
        currentPage: this.currentPage.getStats(),
        lastMessageId: this.lastMessageId.getStats(),
      },
      process: process.memoryUsage(),
    };
  }

  /**
   * Clear all state for a user (helper to prevent leaks)
   */
  private clearUserState(userId: number) {
    this.userStates.delete(userId);
    this.currentPage.delete(userId);
    this.lastMessageId.delete(userId);
  }

  /**
   * Admin command handler - Show admin menu
   */
  async handleAdminCommand(ctx: any) {
    try {
      await this.showAdminMenu(ctx);
    } catch (error) {
      console.error('Admin command error:', error);
      await ctx.reply('❌ Ошибка выполнения команды');
    }
  }

  /**
   * Show admin menu with statistics
   */
  async showAdminMenu(ctx: any) {
    try {
      const username = ctx.from.username || 'Отсутствует';
      const totalBalance = await this.getTotalBalance();
      const stats = await this.getGlobalStats();

      const message =
        '<blockquote><b>🔐 Админ-меню</b></blockquote>\n' +
        `<blockquote><b>👤 Администратор: @${username}</b></blockquote>\n` +
        `<blockquote><b>📊 Количество пользователей: ${stats.total_users}</b></blockquote>\n` +
        `<blockquote><b>💰 Общий баланс пользователей: ${Math.round(totalBalance)} RUB</b></blockquote>\n`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Статистика', 'adminStats'),
          Markup.button.callback('💬 Рассылка', 'spam'),
        ],
        [
          Markup.button.callback('👤 Найти пользователя', 'search_user'),
          Markup.button.callback('🎟 Промокоды', 'promos'),
        ],
        [Markup.button.callback('🎁 Бонусы', 'adminBonuses')],
      ]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      console.error('Error showing admin menu:', error);
      await ctx.reply('❌ Ошибка загрузки админ-панели');
    }
  }

  /**
   * Get total balance of all users
   */
  async getTotalBalance(): Promise<number> {
    try {
      const result = await this.em
        .getConnection()
        .execute('SELECT SUM(balance) as total FROM balances WHERE type = ?', [
          BalanceType.MAIN,
        ]);

      return parseFloat(result[0]?.total || '0');
    } catch (error) {
      console.error('Error getting total balance:', error);
      return 0;
    }
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<{ total_users: number }> {
    try {
      const totalUsers = await this.userRepository.count();
      return { total_users: totalUsers };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return { total_users: 0 };
    }
  }

  /**
   * Show admin bonuses menu
   */
  async showAdminBonuses(ctx: any) {
    try {
      const message =
        '<blockquote>⚙️ Здесь вы можете управлять бонусами:</blockquote>';

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎡 Колесо Фортуны', 'changeFortuneWheel')],
        [Markup.button.callback('🔙 Назад', 'admin')],
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      console.error('Error showing admin bonuses:', error);
      await ctx.reply('❌ Ошибка загрузки меню бонусов');
    }
  }

  /**
   * Handle search user action
   */
  async handleSearchUser(ctx: any) {
    try {
      const adminUserId = ctx.from.id;

      // Set user state to waiting for user ID input
      this.userStates.set(adminUserId, {
        state: 'waiting_for_admin_telegram_id',
      });

      await ctx.editMessageText('👤 Введите ID пользователя:', {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error handling search user:', error);
      await ctx.reply('❌ Ошибка при поиске пользователя');
    }
  }

  /**
   * Handle edit balance action
   */
  async handleEditBalance(ctx: any, userId: number) {
    try {
      const adminUserId = ctx.from.id;

      // Set user state to waiting for new balance input
      this.userStates.set(adminUserId, {
        state: 'waiting_for_new_balance',
        targetUserId: userId,
      });

      await ctx.editMessageText('Введите новую сумму баланса:', {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error handling edit balance:', error);
      await ctx.reply('❌ Ошибка при изменении баланса');
    }
  }

  /**
   * Handle give bonus action
   */
  async handleGiveBonus(ctx: any, userId: number) {
    try {
      const adminUserId = ctx.from.id;

      // Set user state to waiting for bonus amount input
      this.userStates.set(adminUserId, {
        state: 'waiting_for_bonus_amount',
        targetUserId: userId,
      });

      await ctx.editMessageText('Введите сумму бонуса:', {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error handling give bonus:', error);
      await ctx.reply('❌ Ошибка при выдаче бонуса');
    }
  }

  /**
   * Handle new balance input
   */
  async handleNewBalanceInput(ctx: any): Promise<boolean> {
    const adminUserId = ctx.from.id;
    const userState = this.userStates.get(adminUserId);

    if (!userState || userState.state !== 'waiting_for_new_balance') {
      return false;
    }

    const newBalanceText = ctx.message?.text?.trim();
    if (!newBalanceText) {
      return false;
    }

    // Validate balance format
    const newBalance = parseFloat(newBalanceText);
    if (isNaN(newBalance) || newBalance < 0) {
      await ctx.reply('❌ Некорректная сумма. Введите положительное число.');
      return true;
    }

    try {
      const targetUserId = userState.targetUserId!;

      // Use database transaction to ensure atomicity
      await this.em.transactional(async (em) => {
        // Find the target user
        const targetUser = await em.findOne(User, {
          id: targetUserId,
        });
        if (!targetUser) {
          await ctx.reply('❌ Пользователь не найден.');
          this.clearUserState(adminUserId);
          return;
        }

        // Get user's main balance
        const mainBalance = await em.findOne(Balances, {
          user: targetUser,
          type: BalanceType.MAIN,
        });

        if (!mainBalance) {
          await ctx.reply('❌ Баланс пользователя не найден.');
          this.clearUserState(adminUserId);
          return;
        }

        // Record balance history before updating
        const startedAmount = mainBalance.balance || 0;
        const addedAmount = newBalance - startedAmount;
        const finishedAmount = newBalance;

        // Update the balance
        mainBalance.balance = newBalance;
        em.persist(mainBalance);

        // Create balance history record
        const balanceHistory = em.create(BalancesHistory, {
          balance: mainBalance,
          balanceBefore: startedAmount.toString(),
          amount: addedAmount.toString(),
          balanceAfter: finishedAmount.toString(),
          description: `Admin balance update: ${Math.round(addedAmount)} RUB (Admin: ${adminUserId})`,
        });
        em.persist(balanceHistory);

        // Flush all changes in the transaction
        await em.flush();

        // Send confirmation to admin
        await ctx.reply(
          `✅ Баланс успешно обновлен до ${Math.round(newBalance)} RUB`,
        );

        // Send notification to the user (with error handling)
        try {
          // Send first message
          await ctx.telegram.sendMessage(
            targetUser.telegramId,
            '🔄 Ваш баланс был изменен администратором',
          );

          // Send second message with balance and play button
          await ctx.telegram.sendMessage(
            targetUser.telegramId,
            '💰 Новый баланс: ' + Math.round(newBalance) + ' RUB',
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🎰 Играть!',
                      callback_data: 'games',
                    },
                  ],
                ],
              },
            },
          );
        } catch (userNotificationError) {
          // User might not have started a conversation with the bot
          // User might not have started a conversation with the bot - this is normal
          // console.log(`Could not notify user ${targetUser.telegramId}:`, userNotificationError.message);
          // Continue execution - balance was still updated successfully
        }
      });

      // Clear state
      this.clearUserState(adminUserId);
      return true;
    } catch (error) {
      console.error('Error updating balance:', error);
      await ctx.reply('❌ Ошибка при обновлении баланса.');
      this.clearUserState(adminUserId);
      return true;
    }
  }

  /**
   * Handle bonus amount input
   */
  async handleBonusAmountInput(ctx: any): Promise<boolean> {
    const adminUserId = ctx.from.id;
    const userState = this.userStates.get(adminUserId);

    if (!userState || userState.state !== 'waiting_for_bonus_amount') {
      return false;
    }

    const bonusAmountText = ctx.message?.text?.trim();
    if (!bonusAmountText) {
      return false;
    }

    // Validate bonus amount format
    const bonusAmount = parseFloat(bonusAmountText);
    if (isNaN(bonusAmount) || bonusAmount <= 0) {
      await ctx.reply('❌ Некорректная сумма. Введите положительное число.');
      return true;
    }

    try {
      const targetUserId = userState.targetUserId!;

      // Find the target user
      const targetUser = await this.userRepository.findOne({
        id: targetUserId,
      });
      if (!targetUser) {
        await ctx.reply('❌ Пользователь не найден.');
        this.clearUserState(adminUserId);
        return true;
      }

      // Create bonus record
      const bonus = this.bonusesRepository.create({
        user: targetUser,
        amount: bonusAmount.toString(),
        status: BonusStatus.CREATED,
      });

      await this.em.persistAndFlush(bonus);

      // Send confirmation to admin
      await ctx.reply(
        `✅ Бонус ${Math.round(bonusAmount)} RUB успешно выдан пользователю ${targetUser.name || targetUser.telegramId}`,
      );

      // Send notification to the user (with error handling)
      try {
        await ctx.telegram.sendMessage(
          targetUser.telegramId,
          `🎁 Вам выдан бонус: ${Math.round(bonusAmount)} RUB`,
        );

        await ctx.telegram.sendMessage(
          targetUser.telegramId,
          '💰 Проверьте свой бонусный баланс в профиле!',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🎰 Играть!',
                    callback_data: 'myBonuses',
                  },
                ],
              ],
            },
          },
        );
      } catch (userNotificationError) {
        // User might not have started a conversation with the bot - this is normal
        console.log(
          `Could not notify user ${targetUser.telegramId}:`,
          userNotificationError.message,
        );
      }

      // Clear state
      this.clearUserState(adminUserId);
      return true;
    } catch (error) {
      console.error('Error creating bonus:', error);
      await ctx.reply('❌ Ошибка при создании бонуса.');
      this.clearUserState(adminUserId);
      return true;
    }
  }

  /**
   * Handle admin telegram ID input
   */
  async handleAdminTelegramIdInput(ctx: any): Promise<boolean> {
    const adminUserId = ctx.from.id;
    const userState = this.userStates.get(adminUserId);

    if (!userState || userState.state !== 'waiting_for_admin_telegram_id') {
      return false;
    }

    const telegramId = ctx.message?.text?.trim();

    if (!telegramId) {
      return false;
    }

    // Validate telegram ID format
    if (!/^\d+$/.test(telegramId)) {
      await ctx.reply('⚠️ Неверный формат Telegram ID. Введите только цифры.');
      return true;
    }

    try {
      // Find user by telegram ID
      const user = await this.userRepository.findOne(
        { telegramId },
        { populate: ['balances', 'balances.currency'] },
      );

      if (!user) {
        await ctx.reply(
          `❌ Пользователь с Telegram ID <code>${telegramId}</code> не найден в базе данных.`,
          { parse_mode: 'HTML' },
        );
        this.clearUserState(adminUserId);
        return true;
      }

      // Get user balances
      const mainBalance = await this.balancesRepository.findOne(
        { user, type: BalanceType.MAIN },
        { populate: ['currency'] },
      );

      const bonusBalance = await this.balancesRepository.findOne(
        { user, type: BalanceType.BONUS },
        { populate: ['currency'] },
      );

      // Get user statistics
      const userStats = await this.statsService.getUserStats(user.id!);

      // Get user PnL (profit/loss) - for now using actualBet as placeholder
      const userPnL = userStats.actualBet || 0;

      // Format user info according to the specified format
      const text =
        '<blockquote><b>Информация о пользователе:</b></blockquote>\n' +
        `<blockquote>ID: ${user.telegramId}</blockquote>\n` +
        `<blockquote>Имя: ${user.name || 'Не указано'}</blockquote>\n` +
        `<blockquote>Username: @${user.name || 'Отсутствует'}</blockquote>\n` +
        `<blockquote>Баланс: ${Math.round(mainBalance?.balance || 0)} RUB</blockquote>\n` +
        `<blockquote>Бонусный баланс: ${Math.round(bonusBalance?.balance || 0)} RUB</blockquote>\n\n` +
        `<blockquote>Доход от юзера: ${Math.round(userPnL)} RUB</blockquote>\n` +
        `<blockquote>(☝️ Учтите, что в доход не входят\n активные заявки на вывод или пополнение)</blockquote>\n`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✏️ Изменить баланс',
            `edit_balance_${user.id}`,
          ),
        ],
        [Markup.button.callback('🎁 Дать бонус', `give_bonus_${user.id}`)],
        [Markup.button.callback('🎡 Колесо ВЫКЛ', `toggle_wheel_${user.id}`)],
        [Markup.button.callback('⬅️ Назад', 'admin')],
      ]);

      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
      });

      // Clear state
      this.clearUserState(adminUserId);
      return true;
    } catch (error) {
      console.error('Error fetching user info:', error);
      await ctx.reply('❌ Ошибка при получении информации о пользователе');
      this.clearUserState(adminUserId);
      return true;
    }
  }
}
