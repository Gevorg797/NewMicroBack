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

// Export everything for convenient imports
export const ENTITIES = [
    User,
    GameProvider,
    GameSubProvider,
    GameProviderSetting,
    GamesProviderSettingGroup,
    Game,
    GameSession,
    GameTransaction,
    Currency,
];

export {
    User,
    GameProvider,
    GameSubProvider,
    GameProviderSetting,
    GamesProviderSettingGroup,
    Game,
    GameSession,
    GameTransaction,
    Currency,
};
