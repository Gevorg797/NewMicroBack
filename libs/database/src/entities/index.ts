// libs/database/src/entities/index.ts

import { User } from './user.entity';
import { GameProvider } from './game-providers.entity';
import { GameSubProvider } from './game-sub-providers.entity';
import { GameProviderSetting } from './game-provider-settings.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';
import { Game } from './games.entity';
import { GameSession, GameOutcome } from './game-sassion.entity';
import {
  GameTransaction,
  GameTransactionType,
  GameTransactionStatus,
} from './game-transaction.entity';
import { Currency, CurrencyType } from './currency.entity';
import { Site } from './site.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { GameCategory } from './game-category.entity';
import { FinanceProvider } from './finance-provider.entity';
import { FinanceProviderSettings } from './finance-provider-settings.entity';
import { FinanceProviderMethods } from './finance-provider-methods.entity';
import { FinanceProviderSubMethods } from './finance-provider-sub-method.entity';
import {
  FinanceTransactions,
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentTransactionUserResponseStatus,
} from './finance-provider-transactions.entity';
import { SiteSettings } from './site-settings.entity';
import { Balances, BalanceType } from './balances.entity';
import { PaymentPayoutRequisite } from './payment-payout_requisite.entity';
import { Bonuses, BonusStatus } from './bonuses.entity';
import { BalancesHistory } from './balances-history.entity';
import { Promocode, PromocodeType, PromocodeStatus } from './promocode.entity';
import {
  PromocodeUsage,
  PromocodeUsageStatus,
} from './promocode-usage.entity';

// Export everything for convenient imports
// export * from './balances.entity';

export const ENTITIES = [
  User,
  Site,
  SiteSettings,
  Currency,
  GameProvider,
  GameSubProvider,
  GameProviderSetting,
  GamesProviderSettingGroup,
  Game,
  GameSession,
  GameTransaction,
  GameFreeSpin,
  GameCategory,
  FinanceProvider,
  FinanceProviderSettings,
  FinanceProviderMethods,
  FinanceProviderSubMethods,
  FinanceTransactions,
  Balances,
  PaymentPayoutRequisite,
  Bonuses,
  BalancesHistory,
  Promocode,
  PromocodeUsage,
];

export {
  User,
  Site,
  SiteSettings,
  Currency,
  CurrencyType,
  GameProvider,
  GameSubProvider,
  GameProviderSetting,
  GamesProviderSettingGroup,
  Game,
  GameSession,
  GameOutcome,
  GameTransaction,
  GameTransactionType,
  GameTransactionStatus,
  GameFreeSpin,
  GameCategory,
  FinanceProvider,
  FinanceProviderSettings,
  FinanceProviderMethods,
  FinanceProviderSubMethods,
  FinanceTransactions,
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentTransactionUserResponseStatus,
  Balances,
  BalanceType,
  PaymentPayoutRequisite,
  Bonuses,
  BonusStatus,
  BalancesHistory,
  Promocode,
  PromocodeType,
  PromocodeStatus,
  PromocodeUsage,
  PromocodeUsageStatus,
};
