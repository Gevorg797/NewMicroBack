/**
 * Provider-related constants
 */

export const PROVIDER_NAMES = {
    SUPEROMATIC: 'superomatic',
    B2B_SLOTS: 'b2bslots',
} as const;

export const PROVIDER_IDENTIFIERS = {
    SUPEROMATIC: ['superomatic'],
    B2B_SLOTS: ['b2b', 'b2bslots'],
} as const;

export const ERROR_MESSAGES = {
    GAME_NOT_FOUND: (gameId: number) => `Game with ID ${gameId} not found`,
    UNKNOWN_PROVIDER: (gameId: number, providerName: string) =>
        `Unknown provider for game ${gameId}: ${providerName}`,
    UNSUPPORTED_PROVIDER: (providerName: string) =>
        `Unsupported provider: ${providerName}`,
    PROVIDER_SETTINGS_NOT_FOUND: (providerName: string) =>
        `${providerName} provider settings not found`,
    PROVIDER_ID_NOT_SET: (envVar: string) => `${envVar} environment variable is not set`,
} as const;

export const CACHE_KEYS = {
    GAME_PROVIDER: (gameId: number) => `game:provider:${gameId}`,
    PROVIDER_SETTINGS: (siteId: number, providerId: number) =>
        `provider:settings:${siteId}:${providerId}`,
} as const;

export const CACHE_TTL = {
    GAME_PROVIDER: 300, // 5 minutes
    PROVIDER_SETTINGS: 600, // 10 minutes
} as const;
