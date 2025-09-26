import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MS_GAME } from './tokens';

@Injectable()
export class MsGameService {
  constructor(@Inject(MS_GAME) private readonly client: ClientProxy) { }

  // Superomatic patterns
  loadSuperomaticGames(data: { siteId: number; params?: any }) {
    return firstValueFrom(this.client.send('superomatic.loadGames', data));
  }
  superomaticGetCurrencies(data: { userId: number; siteId: number }) {
    return firstValueFrom(this.client.send('superomatic.getCurrencies', data));
  }
  superomaticInitDemo(data: { userId: number; siteId: number; params: any }) {
    return firstValueFrom(
      this.client.send('superomatic.initGameDemoSession', data),
    );
  }
  superomaticInitSession(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.initGameSession', data),
    );
  }
  superomaticFreeRoundsInfo(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.gamesFreeRoundsInfo', data),
    );
  }
  superomaticCheckBalance(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.checkBalance', data),
    );
  }
  superomaticGetGameHistory(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.getGameHistory', data),
    );
  }
  superomaticGetGameStatistics(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.getGameStatistics', data),
    );
  }
  superomaticGetProviderInfo(data: {
    userId: number;
    siteId: number;
    params?: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.getProviderInfo', data),
    );
  }

  superomaticCloseSession(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('superomatic.closeSession', data),
    );
  }

  // B2BSlots patterns
  b2bslotsLoadGames(data: { siteId: number; params?: any }) {
    return firstValueFrom(this.client.send('b2bslots.loadGames', data));
  }
  b2bslotsGetCurrencies(data: { userId: number; siteId: number }) {
    return firstValueFrom(this.client.send('b2bslots.getCurrencies', data));
  }
  b2bslotsInitDemo(data: { userId: number; siteId: number; params: any }) {
    return firstValueFrom(
      this.client.send('b2bslots.initGameDemoSession', data),
    );
  }
  b2bslotsInitSession(data: { userId: number; siteId: number; params: any }) {
    return firstValueFrom(this.client.send('b2bslots.initGameSession', data));
  }
  b2bslotsFreeRoundsInfo(data: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    return firstValueFrom(
      this.client.send('b2bslots.gamesFreeRoundsInfo', data),
    );
  }
}
