import { Injectable } from '@nestjs/common';
import { MsGameService } from 'libs/microservices-clients/ms-game/ms-game.service';

@Injectable()
export class GamesService {
  constructor(private readonly msGameService: MsGameService) { }

  async loadGames(provider: string, data: { siteId: number; params?: any }) {
    if (provider === 'superomatic') {
      return this.msGameService.loadSuperomaticGames(data);
    } else if (provider === 'b2bslots') {
      return this.msGameService.b2bslotsLoadGames(data);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  async getCurrencies(provider: string, data: { userId: number; siteId: number }) {
    if (provider === 'superomatic') {
      return this.msGameService.superomaticGetCurrencies(data);
    } else if (provider === 'b2bslots') {
      return this.msGameService.b2bslotsGetCurrencies(data);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  async initGameDemoSession(provider: string, data: { userId: number; siteId: number; params: any }) {
    if (provider === 'superomatic') {
      return this.msGameService.superomaticInitDemo(data);
    } else if (provider === 'b2bslots') {
      return this.msGameService.b2bslotsInitDemo(data);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  async initGameSession(provider: string, data: { userId: number; siteId: number; params: any }) {
    if (provider === 'superomatic') {
      return this.msGameService.superomaticInitSession(data);
    } else if (provider === 'b2bslots') {
      return this.msGameService.b2bslotsInitSession(data);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  async gamesFreeRoundsInfo(provider: string, data: { userId: number; siteId: number; params: any }) {
    if (provider === 'superomatic') {
      return this.msGameService.superomaticFreeRoundsInfo(data);
    } else if (provider === 'b2bslots') {
      return this.msGameService.b2bslotsFreeRoundsInfo(data);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
