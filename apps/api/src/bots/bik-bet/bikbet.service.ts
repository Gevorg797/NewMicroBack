import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  User,
  Currency,
  Balances,
  BalanceType,
  CurrencyType,
  Site,
} from '@lib/database';
import { Markup } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  PLAYNGO_GAME_NAMES_WITH_IDS,
  NOVOMATIC_GAME_NAMES_WITH_IDS,
  NETENT_GAME_NAMES_WITH_IDS,
  PRAGMATIC_GAME_NAMES_WITH_IDS,
  PUSH_GAME_NAMES_WITH_IDS,
  POPULAR_GAME_NAMES_WITH_IDS,
  BETINHELL_GAME_NAMES_WITH_IDS,
  PLAYTECH_GAME_NAMES_WITH_IDS,
  GameData,
} from './games-data';

@Injectable()
export class BikBetService {
  private readonly totalPlayers = 1311;
  private readonly gamesPlayed = 61192;
  private readonly totalBets = '5973499.88 RUB';
  private readonly userStates = new Map<
    number,
    { chosenBalance?: string; state?: string }
  >();
  private readonly currentPage = new Map<number, number>();
  private readonly lastMessageId = new Map<number, number>();
  private readonly ITEMS_PER_PAGE = 10;
  private readonly SECRET_KEY = 'h553k34n45mktkm55143a';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Currency)
    private readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(Balances)
    private readonly balancesRepository: EntityRepository<Balances>,
  ) {}

  // Game data for different operators (imported from games-data.ts)
  private readonly PRAGMATIC_GAMES = PRAGMATIC_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
    }),
  );

  private readonly NETENT_GAMES = NETENT_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
  }));

  private readonly NOVOMATIC_GAMES = NOVOMATIC_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
    }),
  );

  private readonly PLAYNGO_GAMES = PLAYNGO_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
  }));

  private readonly PUSH_GAMES = PUSH_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
  }));

  private readonly BETINHELL_GAMES = BETINHELL_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
    }),
  );

  private readonly PLAYTECH_GAMES = PLAYTECH_GAME_NAMES_WITH_IDS.map(
    (game) => ({
      id: String(game.id),
      name: game.name,
    }),
  );

  private readonly POPULAR_GAMES = POPULAR_GAME_NAMES_WITH_IDS.map((game) => ({
    id: String(game.id),
    name: game.name,
    provider: game.provider,
  }));

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
      let user = await this.userRepository.findOne({ telegramId });
      if (!user) {
        const fallbackName = (
          (ctx.from.first_name ?? '') +
          ' ' +
          (ctx.from.last_name ?? '')
        ).trim();
        const derivedName = (ctx.from.username ?? fallbackName) || undefined;
        const siteId = 1;
        const em = this.userRepository.getEntityManager();
        let siteRef = await em.findOne(Site, { id: siteId });
        user = this.userRepository.create({
          telegramId,
          name: derivedName,
          site: siteRef,
        } as any);
        await this.userRepository.getEntityManager().persistAndFlush(user);
      }

      // Ensure balances exist for the user with default RUB currency (main and bonus)
      const existingBalances = await this.balancesRepository.find({ user });
      const rub = await this.currencyRepository.findOne({
        name: CurrencyType.RUB,
      });

      if (rub && existingBalances.length === 0) {
        // Create both main and bonus balances
        const mainBalance = this.balancesRepository.create({
          user,
          currency: rub,
          balance: 0,
          type: BalanceType.MAIN,
        } as any);

        const bonusBalance = this.balancesRepository.create({
          user,
          currency: rub,
          balance: 0,
          type: BalanceType.BONUS,
        } as any);

        await this.balancesRepository
          .getEntityManager()
          .persistAndFlush([mainBalance, bonusBalance]);
      }

      const text = `
<blockquote><b>Добро пожаловать в <a href="${link}">BikBet!</a></b></blockquote>
<blockquote>👥 <b>Всего игроков:</b> <code>${this.totalPlayers}</code></blockquote>
<blockquote>🚀 <b>Сыграно игр:</b>
⤷ <code>${this.gamesPlayed}</code>
💸 <b>Сумма ставок:</b>
⤷ <code>${this.totalBets}</code></blockquote>
`;

      await ctx.replyWithPhoto(
        { source: fs.createReadStream(this.getImagePath('bik_bet_8.jpg')) },
        {
          caption: text,
          parse_mode: 'HTML',
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
        },
      );
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

    await ctx.reply(
      message,
      Markup.inlineKeyboard([
        [Markup.button.url('📢 Подписаться', link)],
        [Markup.button.callback('🔄 Проверить подписку', 'check_subscription')],
      ]),
    );
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
    const text = `
<blockquote><b>🎮 Выберите игру:</b></blockquote>
<blockquote><b>💰 Ваш баланс:</b> <code>100</code></blockquote>
<blockquote><b>🎁 Ваш бонусный баланс: 800</b></blockquote>
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
        [Markup.button.callback('Базовые игры', 'ignore_game')],
        [
          Markup.button.callback('🎲 Дайсы', 'ignore_game'),
          Markup.button.callback('⚽️ Футбол', 'ignore_game'),
          Markup.button.callback('🎯 Дартс', 'ignore_game'),
        ],
        [
          Markup.button.callback('🎳 Боулинг', 'ignore_game'),
          Markup.button.callback('🍭 Слот', 'ignore_game'),
          Markup.button.callback('🏀 Баскетбол', 'ignore_game'),
        ],
        [Markup.button.callback('Настоящие игры', 'ignore_game')],
        [Markup.button.callback('🎰 Слоты', 'slotsB2B')],
        [Markup.button.callback('Мультиплеер', 'ignore_game')],
        [
          Markup.button.callback('⚔️ PVP', 'ignore_all'),
          Markup.button.callback('💰 Аукцион', 'ignore_all'),
        ],
        [Markup.button.callback('💸 Пополнить баланс', 'donate')],
        [Markup.button.callback('⬅️ Назад', 'start')],
      ]).reply_markup,
    });
  }

  async start(ctx: any, link: string) {
    const text = `
<blockquote><b>Добро пожаловать в <a href="${link}">BikBet!</a></b></blockquote>
<blockquote>👥 <b>Всего игроков:</b> <code>${this.totalPlayers}</code></blockquote>
<blockquote>🚀 <b>Сыграно игр:</b>
⤷ <code>${this.gamesPlayed}</code>
💸 <b>Сумма ставок:</b>
⤷ <code>${this.totalBets}</code></blockquote>
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

  async slotsB2B(ctx: any) {
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
          [Markup.button.callback('🔙 Назад', 'slotsB2B')],
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

      await ctx.editMessageMedia(media, {
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
        Markup.button.callback(gameTitle, `${pageGames[i].id}_${userId}`),
      );

      if (i + 1 < pageGames.length) {
        const secondGameTitle =
          page === 0 && i + 1 < 2
            ? `🔥 ${pageGames[i + 1].name}`
            : pageGames[i + 1].name;
        row.push(
          Markup.button.callback(
            secondGameTitle,
            `${pageGames[i + 1].id}_${userId}`,
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
      console.log('Callback query already answered or expired');
    }

    try {
      const parts = callbackData.split('_');
      const page = parseInt(parts[2]);
      const userId = parseInt(parts[3]);

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
      console.error(`Error in handle${operatorName}Pagination:`, error);
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
      [Markup.button.callback('🔙 Назад', 'slotsB2B')],
    ]);
  }

  // Game selection handlers
  async handleGameSelection(
    ctx: any,
    callbackData: string,
    gameId: string,
    gameName: string,
    operatorName: string,
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

      const userState = this.getUserState(userId);
      const chosenBalance = userState.chosenBalance || 'main';
      console.log(chosenBalance);

      const operatorId = 40272;
      const currency = 'RUB';
      const language = 'RU';
      const authToken = this.generateUserAuthToken(userId);

      const baseUrl = `https://icdnchannel.com/gamesbycode/${gameId}.gamecode`;
      const params = {
        operator_id: operatorId,
        user_id: String(userId),
        auth_token: authToken,
        currency: currency,
        language: language,
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

      console.log(`Game URL generated for user ${userId}: ${webAppUrl}`);
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
        [Markup.button.callback('⬅️ Назад', 'games')],
      ]).reply_markup,
    });
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
        [Markup.button.callback('От 50р:', 'ignore_game')],
        [
          Markup.button.callback('💎 CryptoBot', 'payment:crypto'),
          Markup.button.callback(
            '👛 FKwallet',
            `paymentSystem_fkwallet_${amount}`,
          ),
        ],
        [
          Markup.button.callback(
            '💳 Оплата с карты(+5% бонус)',
            'depositYOOMONEY_',
          ),
        ],
        [Markup.button.callback('От 50р до 2000р:', 'ignore_game')],
        [Markup.button.callback('📷 СБП', 'paymentSystem_platega_')],
        [Markup.button.callback('От 250р:', 'ignore_game')],
        [
          Markup.button.callback(
            '🛡 Криптовалюты',
            'paymentSystem_cryptocloud_',
          ),
        ],
        [Markup.button.callback('От 500р до 100 000р', 'ignore_game')],

        [Markup.button.callback('💳 Карта', 'paymentSystem_1plat_')],
        [Markup.button.callback('⬅️ Назад', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async profile(ctx: any) {
    const telegramId = String(ctx.from.id);
    const user = await this.userRepository.findOne({ telegramId });
    let balanceValue = 0;
    let bonusValue = 0;
    let currencyCode = 'N/A';
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
        currencyCode = mainBalance.currency?.name ?? 'N/A';
      }
      if (bonusBalance) {
        bonusValue = bonusBalance.balance ?? 0;
      }
    }

    const text = `
<blockquote><b>📊 Статистика</b></blockquote>
<blockquote><b>🆔 ID:</b> <code>${telegramId}</code></blockquote>
<blockquote><b>🎮 Игр сыграно:</b> <code>1</code>
<b>🏆 Игр выиграно: 0</b></blockquote>
<blockquote><b>🎯 Винрейт: 0.00%</b>
 <b>🔥 Винстрик: 0 игр</b>
 <b>💥 Поражений подряд: 0 игр</b></blockquote>
<blockquote><b>💰 Всего поставлено: 0 RUB</b> 
<b>💰 Реально поставлено: 0 RUB</b>
<b>💵 Баланс: 0 RUB</b></blockquote>

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
    const text = `
<blockquote><b>🆔 ID: ${this.totalPlayers}</b></blockquote>
<blockquote>💰 Баланс: <code>${this.totalPlayers}</code></blockquote>
<blockquote> <b>🎁 Бонусный баланс: 0 RUB</b> </blockquote>
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
    const text = `
<blockquote><b>💳 Вывод средств</b></blockquote>
<blockquote><b>💰 Доступно: 0 RUB</b></blockquote>
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
    if (!mainBalance || mainBalance.balance < amount) {
      await ctx.answerCbQuery('Недостаточно средств для вывода данной суммы.');
      return;
    }

    const text = `
<blockquote><b>💳 Вывод средств</b></blockquote>
<blockquote><b>💰 Сумма вывода: ${amount} RUB</b></blockquote>
<blockquote><b>✅ Заявка на вывод ${amount} RUB создана!</b></blockquote>
<blockquote><b>⏱ Ожидайте обработки заявки</b></blockquote>`;

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
        [Markup.button.callback('🏠 Главное меню', 'start')],
      ]).reply_markup,
    });
  }

  async withdrawCustom(ctx: any) {
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

  async fkwalletPayment(ctx: any, amount: number) {
    const text = `
<blockquote><b>👛 FKwallet Payment</b></blockquote>
<blockquote><b>💰 Сумма к оплате: ${amount} RUB</b></blockquote>
<blockquote><b>🔗 Перейдите по ссылке для оплаты через FKwallet</b></blockquote>
<blockquote><b>✅ После оплаты средства поступят на ваш баланс</b></blockquote>`;

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
          Markup.button.url(
            '👛 Оплатить через FKwallet',
            `https://fkwallet.com/pay?amount=${amount}&user=${ctx.from.id}`,
          ),
        ],
        [Markup.button.callback('🔙 Назад к пополнению', 'donate_menu')],
      ]).reply_markup,
    });
  }

  async myBonuses(ctx: any) {
    const text = `
<blockquote><b>🎁 Мои бонусы</b></blockquote>
<blockquote><b>🟢 - Активный</b>
<b>🟠 - Не использован
</b>
<b>🔴 - Использован
</b></blockquote>
<blockquote><b>Показаны последние 10 бонусов
</b></blockquote>
<blockquote><b>📍 Чтобы перейти к бонусу, нажмите на кнопку
</b></blockquote>
`;

    const filePath = this.getImagePath('bik_bet_6.jpg');
    const media: any = {
      type: 'photo',
      media: { source: fs.readFileSync(filePath) },
      caption: text,
      parse_mode: 'HTML',
    };

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'profile')],
      ]).reply_markup,
    });
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
    const text = `<b>🏆 Топ пользователей (по победам):</b>

<blockquote><b>🥇 1. - Synkov | побед - 4065</b></blockquote>
<blockquote><b>🥈 2. - Юзер №2 | побед - 1952</b></blockquote>
<blockquote><b>🥉 3. - Юзер №3 | побед - 1788</b></blockquote>
<blockquote><b>🎖 4. - 13 | побед - 1717</b></blockquote>
<blockquote><b>🎖 5. - Юзер №5 | побед - 714</b></blockquote>
<blockquote><b>🎖 6. - Александра | побед - 703</b></blockquote>
<blockquote><b>🎖 7. - Jimik | побед - 476</b></blockquote>
<blockquote><b>🎖 8. - Maksi | побед - 440</b></blockquote>
<blockquote><b>🎖 9. - Не | побед - 391</b></blockquote>
<blockquote><b>🎖 10. - Алина | побед - 337</b></blockquote>

<i>Отсортировано по количеству побед!</i>`;

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
    const text = `<b>🏆 Топ пользователей (по винстрику):</b>

<blockquote><b>🥇 1. - Максим Андреевич | винстрик - 8</b></blockquote>
<blockquote><b>🥈 2. - Xauceq | винстрик - 5</b></blockquote>
<blockquote><b>🥉 3. - мотя xvii | винстрик - 5</b></blockquote>
<blockquote><b>🎖 4. - Юзер №4 | винстрик - 4</b></blockquote>
<blockquote><b>🎖 5. - Rostik🩸 | винстрик - 4</b></blockquote>
<blockquote><b>🎖 6. - LORDIN | винстрик - 4</b></blockquote>
<blockquote><b>🎖 7. - Korney | винстрик - 4</b></blockquote>
<blockquote><b>🎖 8. - 13 | винстрик - 3</b></blockquote>
<blockquote><b>🎖 9. - Михалы4 | винстрик - 3</b></blockquote>
<blockquote><b>🎖 10. - Миша | винстрик - 3</b></blockquote>

<i>Отсортировано по количеству побед подряд!</i>`;

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
    const text = `<b>🏆 Топ пользователей (по лузстрику):</b>

<blockquote><b>🥇 1. - Pavel | лузстрик - 22</b></blockquote>
<blockquote><b>🥈 2. - Натуля🎀 | лузстрик - 20</b></blockquote>
<blockquote><b>🥉 3. - Рлл | лузстрик - 20</b></blockquote>
<blockquote><b>🎖 4. - Perfect | лузстрик - 20</b></blockquote>
<blockquote><b>🎖 5. - Frend | лузстрик - 19</b></blockquote>
<blockquote><b>🎖 6. - 𝚂𝚂𝙰 | лузстрик - 18</b></blockquote>
<blockquote><b>🎖 7. - серега | лузстрик - 17</b></blockquote>
<blockquote><b>🎖 8. - Светлана | лузстрик - 17</b></blockquote>
<blockquote><b>🎖 9. - Иван | лузстрик - 15</b></blockquote>
<blockquote><b>🎖 10. - Borov | лузстрик - 15</b></blockquote>

<i>Отсортировано по количеству поражений подряд!</i>`;

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
    const text = `<b>🏆 Топ пользователей (по кол-ву игр):</b>

<blockquote><b>🥇 1. - Synkov | игр - 7100</b></blockquote>
<blockquote><b>🥈 2. - R3QU1EM | игр - 6213</b></blockquote>
<blockquote><b>🥉 3. - Юзер №3 | игр - 3321</b></blockquote>
<blockquote><b>🎖 4. - Юзер №4 | игр - 3067</b></blockquote>
<blockquote><b>🎖 5. - 13 | игр - 2852</b></blockquote>
<blockquote><b>🎖 6. - Александра | игр - 1973</b></blockquote>
<blockquote><b>🎖 7. - Юзер №7 | игр - 1290</b></blockquote>
<blockquote><b>🎖 8. - Игорь | игр - 1088</b></blockquote>
<blockquote><b>🎖 9. - Юзер №9 | игр - 891</b></blockquote>
<blockquote><b>🎖 10. - [𝗜𝗧] 𝗠𝗼𝗻𝗸 | игр - 867</b></blockquote>

<i>Отсортировано по количеству игр!</i>`;

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
    const text = `<b>🏆 Топ пользователей (по сумме ставок):</b>

<blockquote><b>🥇 1. - 62240 | ставок на 469367.2000000915 RUB</b></blockquote>
<blockquote><b>🥈 2. - Буеда | ставок на 372955.5500000798 RUB</b></blockquote>
<blockquote><b>🥉 3. - Антоха | ставок на 344004.7199999913 RUB</b></blockquote>
<blockquote><b>🎖 4. - Юзер №4 | ставок на 246371.17000000295 RUB</b></blockquote>
<blockquote><b>🎖 5. - Игорь | ставок на 202940.03000000017 RUB</b></blockquote>
<blockquote><b>🎖 6. - 𝓐𝓷𝓰𝓮𝓵 ❤️‍🩹 | ставок на 195294.40000001568 RUB</b></blockquote>
<blockquote><b>🎖 7. - Valfram👾 BITS | ставок на 193849.7600000002 RUB</b></blockquote>
<blockquote><b>🎖 8. - van | ставок на 175589.27000000633 RUB</b></blockquote>
<blockquote><b>🎖 9. - Дима | ставок на 166294.00000000108 RUB</b></blockquote>
<blockquote><b>🎖 10. -                             | ставок на 163915.0100000036 RUB</b></blockquote>

<i>Отсортировано по общей сумме ставок!</i>`;

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
}
