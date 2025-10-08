import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MS_GAME } from 'libs/config';
import { firstValueFrom } from 'rxjs';
import { BalanceType } from '@lib/database';
// import { MS_GAME } from './tokens';

@Injectable()
export class MsGameService {
  constructor(@Inject(MS_GAME) private readonly client: ClientProxy) { }

  // ===== UNIFIED GAME ROUTING METHODS =====
  // These methods automatically route to the correct provider based on gameId

  /**
   * Initialize a game session - automatically routes to correct provider based on gameId
   * @param data Must include gameId for provider routing
   */
  initGameSession(data: {
    userId: number;
    siteId: number;
    gameId: number;
    balanceType?: BalanceType;
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.initGameSession', data));
  }

  /**
   * Initialize a demo game session - automatically routes to correct provider based on gameId
   * @param data Must include gameId for provider routing
   */
  initGameDemoSession(data: {
    userId: number;
    siteId: number;
    gameId: number;
    balanceType?: BalanceType;
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.initGameDemoSession', data));
  }

  /**
   * Get free rounds info - automatically routes to correct provider based on gameId
   * @param data Must include gameId for provider routing
   */
  gamesFreeRoundsInfo(data: {
    userId: number;
    siteId: number;
    gameId: number;
    balanceType?: BalanceType;
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.gamesFreeRoundsInfo', data));
  }

  /**
   * Close a game session - automatically routes to correct provider based on user's active session
   * @param data Only requires userId - siteId and gameId are determined from the active session
   */
  closeSession(data: {
    userId: number;
    siteId?: number; // Optional - determined from user's session
    gameId?: number; // Optional - determined from user's active session
    params?: any;
  }) {
    return firstValueFrom(this.client.send('game.closeSession', data));
  }

  /**
   * Load games from a specific provider - uses provider name instead of gameId
   * @param data Must include providerName (e.g., 'superomatic', 'b2bslots')
   */
  loadGames(data: {
    siteId: number;
    providerName: string;
    params?: any;
  }) {
    return firstValueFrom(this.client.send('game.loadGames', data));
  }

  /**
   * Get currencies - automatically routes to correct provider based on gameId
   * @param data Must include gameId for provider routing
   */
  getCurrencies(data: {
    userId: number;
    siteId: number;
    gameId: number;
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.getCurrencies', data));
  }

  // ===== CONVENIENCE METHODS =====
  // Helper methods for common operations

  /**
   * Load games from Superomatic provider
   */
  loadSuperomaticGames(data: { siteId: number; params?: any }) {
    return this.loadGames({
      siteId: data.siteId,
      providerName: 'superomatic',
      params: data.params
    });
  }

  /**
   * Load games from B2BSlots provider
   */
  loadB2BSlotsGames(data: { siteId: number; params?: any }) {
    return this.loadGames({
      siteId: data.siteId,
      providerName: 'b2bslots',
      params: data.params
    });
  }


}
