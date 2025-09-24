// libs/database/src/entities/index.ts

import { User } from './user.entity';
import { GameProvider } from './game-providers.entity';
import { GameSubProvider } from './game-sub-providers.entity';
import { GameProviderSetting } from './game-provider-settings.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';
import { Game } from './games.entity';
import { GameSession } from './game-sassion.entity';
import { GameTransaction } from './game-transaction.entity';
import { Currency } from './currency.entity';
import { Site } from './site.entity';
import { GameFreeSpin } from './game-free-spins.entity';
import { GameCategory } from './game-category.entity';

// Export everything for convenient imports
export const ENTITIES = [
  User,
  Site,
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
];

export {
  User,
  Site,
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
};
