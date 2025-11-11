import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BikBetService } from './bikbet.service';
import { Telegraf } from 'telegraf';
import { checkIsTelegramAdmin } from 'libs/utils/decorator/telegram-admin.decorator';

@ApiTags('clients')
@Controller('clients')
export class BikBetController {
  private bot: Telegraf;
  constructor(private readonly bikbetService: BikBetService) {
    this.bot = new Telegraf(process.env.BOT_TOKEN as string);
  }

  /**
   * Get memory statistics for monitoring
   */
  @Get('memory-stats')
  getMemoryStats() {
    return this.bikbetService.getMemoryStats();
  }

  /**
   * Get financial statistics for admin panel
   */
  @Get('financial-stats')
  async getFinancialStats(@Query('siteId') siteId: string) {
    const siteIdNumber = parseInt(siteId, 10);
    if (isNaN(siteIdNumber)) {
      throw new Error('Invalid siteId parameter');
    }
    return this.bikbetService.getFinancialStats(siteIdNumber);
  }

  onModuleInit() {
    const channelId = '-1002953826717'; // replace with your channel
    const channelLink = 'https://t.me/+Q1wQJIeOz7YyYzAy'; // your channel link

    // /start handler
    this.bot.start(async (ctx) => {
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
    });

    // /admin handler - Show admin menu
    this.bot.command('admin', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await this.bikbetService.handleAdminCommand(ctx);
    });

    // Admin menu button handlers
    this.bot.action('adminStats', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.handleAdminStats(ctx);
    });

    this.bot.action('spam', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.startSpamFlow(ctx);
    });

    this.bot.action('spam_confirm_yes', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.handleSpamConfirmation(ctx, true);
    });

    this.bot.action('spam_confirm_no', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.handleSpamConfirmation(ctx, false);
    });

    this.bot.action('search_user', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.handleSearchUser(ctx);
    });

    this.bot.action('promos', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.showAdminPromos(ctx);
    });

    // Admin promos: create
    this.bot.action('createPromo', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.promptCreatePromo(ctx);
    });

    // Admin promos: delete
    this.bot.action('deletePromo', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.promptDeletePromo(ctx);
    });

    // Admin promos: confirmations
    this.bot.action('promoCreateYes', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;
      await ctx.answerCbQuery();
      await this.bikbetService.confirmCreatePromo(ctx, true);
    });
    this.bot.action('promoCreateNo', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;
      await ctx.answerCbQuery('❌ Отменено');
      await this.bikbetService.confirmCreatePromo(ctx, false);
    });

    this.bot.action('promoDelete_yes', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;
      await ctx.answerCbQuery();
      await this.bikbetService.confirmDeletePromo(ctx, true);
    });
    this.bot.action('promoDelete_no', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;
      await ctx.answerCbQuery('❌ Отменено');
      await this.bikbetService.confirmDeletePromo(ctx, false);
    });

    // Back to admin menu
    this.bot.action('adm_menu', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;
      await ctx.answerCbQuery();
      await this.bikbetService.handleAdminCommand(ctx);
    });

    this.bot.action('adminBonuses', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.showAdminBonuses(ctx);
    });

    // Wheel configuration handlers
    this.bot.action('changeFortuneWheel', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.showWheelConfig(ctx);
    });

    this.bot.action('changeGivingWheel', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await this.bikbetService.showWheelGivingTypes(ctx);
    });

    this.bot.action(/changeWheel_(enoughSum|limit)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const changeType = ctx.match[1];
      await this.bikbetService.handleWheelConfigChange(ctx, changeType);
    });

    this.bot.action(/newGiving_(super|good|normal|bad)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const givingType = ctx.match[1];
      await this.bikbetService.handleWheelGivingChange(ctx, givingType);
    });

    this.bot.action('cancel_wheel_config', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const adminUserId = ctx.from.id;
      this.bikbetService.clearWheelConfigState(adminUserId);
      await this.bikbetService.showAdminBonuses(ctx);
    });

    // Wheel unlock/lock handlers
    this.bot.action(/wheel_(\d+)_(lock|unlock)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const telegramId = ctx.match[1];
      const action = ctx.match[2];
      await this.bikbetService.handleWheelToggleConfirm(
        ctx,
        telegramId,
        action,
      );
    });

    this.bot.action(/removeWheel_(\d+)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const telegramId = ctx.match[1];
      await this.bikbetService.handleRemoveWheel(ctx, telegramId);
    });

    this.bot.action(/unlockWheel_(\d+)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const telegramId = ctx.match[1];
      await this.bikbetService.handleUnlockWheelPrompt(ctx, telegramId);
    });

    this.bot.action(/notificationAboutWheel_(\d+)_(\d+)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const telegramId = ctx.match[1];
      const days = ctx.match[2];
      await this.bikbetService.handleNotificationAboutWheel(
        ctx,
        telegramId,
        days,
      );
    });

    // Edit balance handler
    this.bot.action(/edit_balance_(\d+)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const userId = parseInt(ctx.match[1]);
      await this.bikbetService.handleEditBalance(ctx, userId);
    });

    // Give bonus handler
    this.bot.action(/give_bonus_(\d+)/, async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      const userId = parseInt(ctx.match[1]);
      await this.bikbetService.handleGiveBonus(ctx, userId);
    });

    // Bonus click handler
    this.bot.action(/bonus_(\d+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.handleBonusClick(ctx, bonusId);
    });

    // Activate bonus handler
    this.bot.action(/activateBonus_(\d+)/, async (ctx) => {
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.activateBonus(ctx, bonusId);
    });

    // Agree to bonus activation handler
    this.bot.action(/agreeBonus_(\d+)/, async (ctx) => {
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.agreeBonusActivation(ctx, bonusId);
    });

    // Get active bonus handler
    this.bot.action(/getActiveBonus_(\d+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.getActiveBonus(ctx, bonusId);
    });

    // Transfer bonus handler - shows the transfer page
    this.bot.action(/transfer_(\d+)/, async (ctx) => {
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.showTransferBonusPage(ctx, bonusId);
    });

    // Confirm transfer handler - actually performs the transfer
    this.bot.action(/confirmTransfer_(\d+)/, async (ctx) => {
      const bonusId = parseInt(ctx.match[1]);
      await this.bikbetService.transferBonusBalance(ctx, bonusId);
    });

    // Disabled bonus handler
    this.bot.action('disabled_button', async (ctx) => {
      await ctx.answerCbQuery();
      return;
    });

    this.bot.action('users_dumps', async (ctx) => {
      const isAdmin = await checkIsTelegramAdmin(ctx);
      if (!isAdmin) return;

      await ctx.answerCbQuery();
      await ctx.reply('🔍 <b>Дамп юзеров</b>\n\nФункция в разработке...', {
        parse_mode: 'HTML',
      });
    });

    // Button click handler
    this.bot.action('check_subscription', async (ctx) => {
      // Don't answer here - let checkSubscription handle it based on subscription status
      await this.bikbetService.checkSubscription(ctx, channelId, channelLink);
    });

    // Dynamic deposit amount handler: deposit:<amount>
    this.bot.action(/deposit:(.+)/, async (ctx) => {
      const match = (ctx as any).match?.[1];

      // Handle custom deposit
      if (match === 'custom') {
        await ctx.answerCbQuery();
        await this.bikbetService.depositCustom(ctx);
        return;
      }

      // Handle specific amounts
      const amount = Number(match);
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

    // Withdraw CryptoBot handler: withdrCrypto_cryptobot_<amount>
    this.bot.action(/withdrCrypto_cryptobot_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawCryptoBot(ctx, amount);
      } catch (error) {
        console.error('Withdraw CryptoBot handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // CryptoBot withdrawal confirmation handlers
    this.bot.action('kb_accept', async (ctx) => {
      try {
        await ctx.answerCbQuery();

        await this.bikbetService.handleCryptoBotAccept(ctx);
      } catch (error) {
        console.error('CryptoBot accept handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    this.bot.action('kb_reject', async (ctx) => {
      try {
        await ctx.answerCbQuery('❌ Отменено');
        await this.bikbetService.handleCryptoBotReject(ctx);
      } catch (error) {
        console.error('CryptoBot reject handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw FKwallet handler: withdrCrypto_fkwallet_<amount>
    this.bot.action(/withdrCrypto_fkwallet_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawFKwallet(ctx, amount);
      } catch (error) {
        console.error('Withdraw FKwallet handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw USDT (trc-20) handler: withdrCrypto_usdt20_<amount>
    this.bot.action(/withdrCrypto_usdt20_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        if (amount < 500) {
          await ctx.answerCbQuery('Минимальная сумма вывода USDT 500 RUB');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawUSDT20(ctx, amount);
      } catch (error) {
        console.error('Withdraw USDT handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw Card handler: withdrFiat_card_<amount>
    this.bot.action(/withdrFiat_card_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }

        if (amount < 500) {
          await ctx.answerCbQuery('Минимальная сумма вывода на карту 500 RUB');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawCard(ctx, amount);
      } catch (error) {
        console.error('Withdraw Card handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw SBP handler: withdrFiat_sbp_<amount>
    this.bot.action(/withdrFiat_sbp_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        if (amount < 500) {
          await ctx.answerCbQuery('Минимальная сумма вывода через СБП 500 RUB');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.withdrawSBP(ctx, amount);
      } catch (error) {
        console.error('Withdraw SBP handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Save requisite handler: saveReq:<method>:<requisite>
    this.bot.action(/saveReq:(.+):(.+)/, async (ctx) => {
      try {
        const match = (ctx as any).match;
        const method = match?.[1];
        const requisite = match?.[2];

        if (!method || !requisite) {
          await ctx.answerCbQuery('Некорректные данные');
          return;
        }

        await this.bikbetService.saveWithdrawRequisite(ctx, method, requisite);
      } catch (error) {
        console.error('Save requisite handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка сохранения реквизитов');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Use saved requisite handler: useSavedReq:<method>:<amount>
    this.bot.action(/useSavedReq:(.+):(.+)/, async (ctx) => {
      try {
        const match = (ctx as any).match;
        const method = match?.[1];
        const amount = Number(match?.[2]);

        if (!method || !Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректные данные');
          return;
        }

        await this.bikbetService.useSavedWithdrawRequisite(ctx, method, amount);
      } catch (error) {
        console.error('Use saved requisite handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw approve handler: withdraw_<id>_approve_<method>
    this.bot.action(/withdraw_(\d+)_approve_(.+)/, async (ctx) => {
      try {
        const match = (ctx as any).match;
        const withdrawalId = Number(match?.[1]);
        const method = match?.[2];

        if (!Number.isFinite(withdrawalId) || !method) {
          await ctx.answerCbQuery('Некорректный запрос', {
            show_alert: true,
          });
          return;
        }

        await this.bikbetService.handleWithdrawApprove(
          ctx,
          withdrawalId,
          method,
        );
      } catch (error) {
        console.error('Withdraw approve handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка подтверждения вывода', {
            show_alert: true,
          });
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Withdraw reject handler: withdraw_<id>_reject_<method>
    this.bot.action(/withdraw_(\d+)_reject_(.+)/, async (ctx) => {
      try {
        const match = (ctx as any).match;
        const withdrawalId = Number(match?.[1]);
        const method = match?.[2];

        if (!Number.isFinite(withdrawalId) || !method) {
          await ctx.answerCbQuery('Некорректные данные');
          return;
        }

        await this.bikbetService.handleWithdrawReject(
          ctx,
          withdrawalId,
          method,
        );
      } catch (error) {
        console.error('Withdraw reject handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка отклонения вывода');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Game history (admin) placeholder: gameDump_<userId>
    this.bot.action(/gameDump_(\d+)/, async (ctx) => {
      try {
        await ctx.answerCbQuery('⚙️ Разработка в процессе', {
          show_alert: true,
        });
      } catch (error) {
        console.error('Game dump placeholder error:', error);
      }
    });

    // Remove message handler
    this.bot.action('removeMSG', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
      } catch (error) {
        console.error('Remove message error:', error);
      }
    });

    // Pass handler (no-op for disabled buttons)
    this.bot.action('wheelSpin_pass', async (ctx) => {
      await ctx.answerCbQuery('❌ Не выполнены условия колеса фортуны');
    });

    // Wheel spin handler: wheelSpin_<transactionId>
    this.bot.action(/wheelSpin_(\d+)/, async (ctx) => {
      try {
        const amount = parseInt((ctx as any).match?.[1], 10);
        await this.bikbetService.handleWheelSpin(ctx, amount);
      } catch (error) {
        console.error('Wheel spin handler error:', error);
        try {
          await ctx.answerCbQuery('❌ Ошибка при обработке запроса');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Pass handler (no-op for disabled buttons)
    this.bot.action('pass', async (ctx) => {
      await ctx.answerCbQuery();
    });

    // FKwallet payment handler: paymentSystem_fkwallet_<amount>
    this.bot.action(/paymentSystem_fkwallet_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await this.bikbetService.fkwalletPayment(ctx, amount);
      } catch (error) {
        console.error('FKwallet payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // YooMoney payment handler: paymentSystem_yoomoney_<amount>
    this.bot.action(/paymentSystem_yoomoney_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.yoomoneyPayment(ctx, amount);
      } catch (error) {
        console.error('YooMoney payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // CryptoBot payment handler: paymentSystem_cryptobot_<amount>
    this.bot.action(/paymentSystem_cryptobot_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await this.bikbetService.cryptobotPayment(ctx, amount);
      } catch (error) {
        console.error('CryptoBot payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // CryptoCloud payment handler: paymentSystem_cryptocloud_<amount>
    this.bot.action(/paymentSystem_cryptocloud_(.+)/, async (ctx) => {
      await ctx.answerCbQuery('⏳ В разработке');
    });

    // Platega payment handler: paymentSystem_platega_<amount>
    this.bot.action(/paymentSystem_platega_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        await ctx.answerCbQuery();
        await this.bikbetService.plategaPayment(ctx, amount);
      } catch (error) {
        console.error('Platega payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // OPS SBP payment handler: paymentSystemSbp_ops<amount>
    this.bot.action(/paymentSystemSbp_ops_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);
        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }

        if (amount < 1000) {
          await ctx.answerCbQuery('❌ Сумма не может быть меньше 1000руб!');
          return;
        }

        await this.bikbetService.opsPaymentSbp(ctx, amount);
      } catch (error) {
        console.error('OPS SBP payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // OPS Card payment handler: paymentSystemCard_ops<amount>
    this.bot.action(/paymentSystemCard_ops_(.+)/, async (ctx) => {
      try {
        const amount = Number((ctx as any).match?.[1]);

        if (!Number.isFinite(amount)) {
          await ctx.answerCbQuery('Некорректная сумма');
          return;
        }
        if (amount < 1000) {
          await ctx.answerCbQuery('❌ Сумма не может быть меньше 1000руб!');
          return;
        }
        await this.bikbetService.opsPaymentCard(ctx, amount);
      } catch (error) {
        console.error('OPS Card payment handler error:', error);
        try {
          await ctx.answerCbQuery('Ошибка обработки платежа');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
    });

    // Game button click handler
    this.bot.action('games', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.game(ctx);
    });

    // Balances button click handler
    this.bot.action('donate_menu', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch (error) {
        // Ignore if callback query is too old or already answered
        console.log('Callback query already expired:', error.message);
      }
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

    // Promo Enter button click handler
    this.bot.action('promoEnter', async (ctx) => {
      await this.bikbetService.promoEnter(ctx);
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
      await ctx.answerCbQuery();
    });

    // Ignore button click handler
    this.bot.action('ignore_all', async (ctx) => {
      await ctx.answerCbQuery('⏳ В разработке');
    });

    // Start game button click handler
    this.bot.action('slots', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.slots(ctx);
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

    this.bot.action(/operator_gaminator_(.+)/, async (ctx) => {
      await this.bikbetService.showGaminatorGames(
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

    this.bot.action(/operator_igrosoft_(.+)/, async (ctx) => {
      await this.bikbetService.showIgrosoftGames(
        ctx,
        (ctx.callbackQuery as any).data,
      );
    });

    this.bot.action(/operator_3oaks_(.+)/, async (ctx) => {
      await this.bikbetService.show3OaksGames(
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
    this.bot.action(/prev_gaminator_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Gaminator',
        this.bikbetService['GAMINATOR_GAMES'],
      );
    });

    this.bot.action(/next_gaminator_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'Gaminator',
        this.bikbetService['GAMINATOR_GAMES'],
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

    this.bot.action(/prev_igrosoft_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'IgroSoft',
        this.bikbetService['IGROSOFT_GAMES'],
      );
    });

    this.bot.action(/next_igrosoft_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        'IgroSoft',
        this.bikbetService['IGROSOFT_GAMES'],
      );
    });

    this.bot.action(/prev_3oaks_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        '3Oaks',
        this.bikbetService['THREE_OAKS_GAMES'],
      );
    });

    this.bot.action(/next_3oaks_page_(\d+)_(.+)/, async (ctx) => {
      await this.bikbetService.handleOperatorPagination(
        ctx,
        (ctx.callbackQuery as any).data,
        '3Oaks',
        this.bikbetService['THREE_OAKS_GAMES'],
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

    // Dynamic game selection handler - handles all game categories
    // Format: gameId_userId_operatorName (e.g., "2_838474735_Popular")
    this.bot.action(/^(\d+)_(\d+)_(.+)$/, async (ctx) => {
      let callbackData = (ctx.callbackQuery as any).data;
      const parts = callbackData.split('_');
      const operatorName = parts[2]; // e.g., "Popular", "PragmaticPlay", "NetEnt"

      callbackData = callbackData.replace(/_[^_]+$/, '');
      try {
        // Route to the appropriate handler based on operator name
        switch (operatorName.toLowerCase()) {
          case 'popular':
            await this.bikbetService.handlePopularGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'pragmaticplay':
          case 'pragmatic':
          case 'pp':
            await this.bikbetService.handlePragmaticGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'netent':
            await this.bikbetService.handleNetEntGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'gaminator':
          case 'gaminator v1':
          case 'novomatic':
            await this.bikbetService.handleGaminatorGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'playngo':
            await this.bikbetService.handlePlaynGoGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'pushgaming':
          case 'push':
            await this.bikbetService.handlePushGameSelection(ctx, callbackData);
            break;

          case 'betinhell':
            await this.bikbetService.handleBetinhellGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'playtech':
            await this.bikbetService.handlePlayTechGameSelection(
              ctx,
              callbackData,
            );
            break;

          case 'igrosoft':
            await this.bikbetService.handleIgrosoftGameSelection(
              ctx,
              callbackData,
            );
            break;

          case '3oaks':
            await this.bikbetService.handle3OaksGameSelection(
              ctx,
              callbackData,
            );
            break;

          default:
            // Unknown operator
            console.warn(`Unknown game operator: ${operatorName}`);
            try {
              await ctx.answerCbQuery('Неизвестный оператор игры');
            } catch (error) {
              console.error('Failed to answer callback query:', error);
            }
        }
      } catch (error) {
        console.error(
          `Game selection handler error for operator ${operatorName}:`,
          error,
        );
        try {
          await ctx.answerCbQuery('Ошибка загрузки игры');
        } catch (e) {
          // Ignore if callback query already answered
        }
      }
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

    // Deposit Custom handler is now handled by the dynamic deposit handler above
    // Withdraw Custom handler is now handled by the dynamic withdraw handler above

    //My Bounses button click handler
    this.bot.action('myBonuses', async (ctx) => {
      await ctx.answerCbQuery();
      await this.bikbetService.myBonuses(ctx);
    });

    // Handle incoming photos for admin flows
    this.bot.on('photo', async (ctx) => {
      try {
        const handledSpamPhoto =
          await this.bikbetService.handleSpamPhotoInput(ctx);
        if (handledSpamPhoto) {
          return;
        }
      } catch (error) {
        console.error('Photo message handler error:', error);
      }
    });

    // Handle text messages for custom deposit/withdraw amounts and admin commands
    this.bot.on('text', async (ctx) => {
      try {
        // User: promo enter flow
        const handledPromoEnter =
          await this.bikbetService.handlePromoEnterInput(ctx);
        if (handledPromoEnter) {
          return;
        }

        // Admin: promo flows
        const handledPromoCreate =
          await this.bikbetService.handlePromoCreateInput(ctx);
        if (handledPromoCreate) {
          return;
        }

        const handledPromoDelete =
          await this.bikbetService.handlePromoDeleteInput(ctx);
        if (handledPromoDelete) {
          return;
        }

        const handledSpamText =
          await this.bikbetService.handleSpamTextMessage(ctx);
        if (handledSpamText) {
          return;
        }

        // Check if admin is waiting for wheel config input
        const handledWheelConfig =
          await this.bikbetService.processWheelConfigValue(
            ctx,
            ctx.message.text,
          );
        if (handledWheelConfig) {
          return;
        }

        // Check if admin is waiting for unlock wheel days input
        const handledUnlockWheel =
          await this.bikbetService.processUnlockWheelDays(
            ctx,
            ctx.message.text,
          );
        if (handledUnlockWheel) {
          return;
        }

        // Check if admin is waiting for telegram ID input
        const handledAdmin =
          await this.bikbetService.handleAdminTelegramIdInput(ctx);
        if (handledAdmin) {
          return;
        }

        // Check if admin is waiting for new balance input
        const handledBalance =
          await this.bikbetService.handleNewBalanceInput(ctx);
        if (handledBalance) {
          return;
        }

        // Check if admin is waiting for bonus amount input
        const handledBonus =
          await this.bikbetService.handleBonusAmountInput(ctx);
        if (handledBonus) {
          return;
        }

        // Check if user is waiting to enter a custom deposit amount
        const handledDeposit =
          await this.bikbetService.handleCustomDepositAmount(ctx);
        if (handledDeposit) {
          return;
        }

        // Check if user is waiting to enter a custom withdraw amount
        const handledWithdraw =
          await this.bikbetService.handleForWithdrawText(ctx);
        if (handledWithdraw) {
          return;
        }

        // If not handled by any custom amount handler, you can add default behavior here if needed
      } catch (error) {
        console.error('Text message handler error:', error);
        await ctx.reply(
          '❌ Произошла ошибка. Попробуйте снова или вернитесь в главное меню /start',
        );
      }
    });

    // Global error handler for expired callback queries and other errors
    this.bot.catch((err: any, ctx) => {
      console.error('Bot error:', err);
      // Don't crash the bot for expired callback queries
      if (err?.message?.includes('query is too old')) {
        console.log('Ignoring expired callback query');
        return;
      }
      if (err?.message?.includes('BUTTON_DATA_INVALID')) {
        console.log('Ignoring invalid button data');
        return;
      }
    });

    this.bot.launch();
  }
}
