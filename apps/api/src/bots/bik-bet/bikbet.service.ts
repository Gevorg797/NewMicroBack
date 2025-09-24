import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BikBetService {
  private readonly totalPlayers = 1311;
  private readonly gamesPlayed = 61192;
  private readonly totalBets = '5973499.88 RUB';

  constructor() {}

  async checkSubscription(ctx: any, channelId: string, link: string) {
    try {
      const member = await ctx.telegram.getChatMember(channelId, ctx.from.id);

      if (member.status === 'left' || member.status === 'kicked') {
        return await this.sendSubscriptionPrompt(ctx, link);
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

    await ctx.answerCbQuery();

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

    await ctx.answerCbQuery();

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
    await ctx.answerCbQuery();
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

    await ctx.answerCbQuery();

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('100 RUB', 'ignore_game'),
          Markup.button.callback('250 RUB', 'ignore_game'),
        ],
        [
          Markup.button.callback('500 RUB', 'ignore_game'),
          Markup.button.callback('1000 RUB', 'ignore_game'),
        ],
        [
          Markup.button.callback('2500 RUB', 'ignore_game'),
          Markup.button.callback('5000 RUB', 'ignore_game'),
        ],
        [Markup.button.callback('💰 Своя сумма', 'deposit:custom')],
        [Markup.button.callback('⬅️ Назад', 'start')],
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

    await ctx.answerCbQuery();

    await ctx.editMessageMedia(media, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'games')],
      ]).reply_markup,
    });
  }
}
