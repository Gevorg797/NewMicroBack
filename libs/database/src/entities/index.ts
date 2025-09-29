// libs/database/src/entities/index.ts

import { User } from './user.entity';
import { GameProvider } from './game-providers.entity';
import { GameSubProvider } from './game-sub-providers.entity';
import { GameProviderSetting } from './game-provider-settings.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';
import { Game } from './games.entity';
import { GameSession } from './game-sassion.entity';
import { GameTransaction } from './game-transaction.entity';
import { Currency, CurrencyType } from './currency.entity';
import { Site } from './site.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { GameCategory } from './game-category.entity';
import { FinanceProvider } from './finance-provider.entity';
import { FinanceProviderSettings } from './finance-provider-settings.entity';
import { FinanceProviderMethods } from './finance-provider-methods.entity';
import { FinanceTransactions } from './finance-provider-transactions.entity';
import { SiteSettings } from './site-settings.entity';
import { Balances } from './balances.entity';

// Export everything for convenient imports
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
  FinanceTransactions,
  Balances
];

export {
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
  FinanceTransactions,
  Balances
};
