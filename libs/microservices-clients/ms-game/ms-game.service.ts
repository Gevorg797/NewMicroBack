import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MS_GAME } from './tokens';

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
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.gamesFreeRoundsInfo', data));
  }

  /**
   * Close a game session - automatically routes to correct provider based on gameId
   * @param data Must include gameId for provider routing
   */
  closeSession(data: {
    userId: number;
    siteId: number;
    gameId: number;
    params: any;
  }) {
    return firstValueFrom(this.client.send('game.closeSession', data));
  }

  // ===== PROVIDER-SPECIFIC METHODS =====
  // These methods are kept for operations that don't require gameId routing

  /**
   * Load games from Superomatic provider
   */
  loadSuperomaticGames(data: { siteId: number; params?: any }) {
    return firstValueFrom(this.client.send('superomatic.loadGames', data));
  }

  /**
   * Load games from B2BSlots provider
   */
  loadB2BSlotsGames(data: { siteId: number; params?: any }) {
    return firstValueFrom(this.client.send('b2bslots.loadGames', data));
  }

}
