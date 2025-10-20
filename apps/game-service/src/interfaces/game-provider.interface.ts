/**
 * Core interfaces for game provider abstraction
 */
import { BalanceType } from '@lib/database';

export interface SessionPayload {
    userId: number;
    siteId?: number; // Optional for closeSession (determined from user's site)
    gameId?: number; // Optional for closeSession (determined from active session)
    params?: Record<string, any>;
    balanceType?: BalanceType; // Optional: specify which balance to use (main or bonus)
}

export interface ProviderPayload {
    userId: number;
    siteId: number;
    balanceType?: BalanceType; // Optional: specify which balance to use (main or bonus)
    params: Record<string, any>;
}

export interface CloseSessionPayload {
    userId: number;
    siteId?: number; // Optional: determined from user's active session
}

export interface LoadGamesPayload {
    siteId: number;
    providerName: string;
    params?: Record<string, any>;
}

export interface GameProviderInfo {
    providerName: string;
    gameIdStr: string;
}

export interface ProviderSettings {
    baseURL: string;
    key: string;
    providerId: number;
    partnerAlias?: string;
    token?: string; // For B2BSlots operator ID
}

export interface GameLoadResult {
    loadGamesCount: number;
    deleteGamesCount: number;
    totalGames?: number;
    games?: any[];
}

/**
 * Abstract interface that all game providers must implement
 */
export interface IGameProvider {
    loadGames(payload: ProviderPayload): Promise<GameLoadResult>;
    getCurrencies(payload: ProviderPayload): Promise<any>;
    initGameSession(payload: ProviderPayload): Promise<any>;
    initGameDemoSession(payload: ProviderPayload): Promise<any>;
    gamesFreeRoundsInfo(payload: ProviderPayload): Promise<any>;
    closeSession(payload: ProviderPayload): Promise<any>;
}

/**
 * Extended interface for providers that support additional operations
 */
export interface IExtendedGameProvider extends IGameProvider {
    checkBalance?(payload: ProviderPayload): Promise<any>;
    getGameHistory?(payload: ProviderPayload): Promise<any>;
    getGameStatistics?(payload: ProviderPayload): Promise<any>;
    getProviderInfo?(payload: ProviderPayload): Promise<any>;
    cancelTransaction?(payload: ProviderPayload): Promise<any>;
    completeTransaction?(payload: ProviderPayload): Promise<any>;
    checkSession?(payload: ProviderPayload): Promise<any>;
    withdrawBet?(payload: ProviderPayload): Promise<any>;
    depositWin?(payload: ProviderPayload): Promise<any>;
}
