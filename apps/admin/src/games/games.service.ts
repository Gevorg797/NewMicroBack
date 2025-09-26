import { Injectable } from '@nestjs/common';
import { MsGameService } from 'libs/microservices-clients/ms-game/ms-game.service';
import { EntityManager } from '@mikro-orm/postgresql';
import { Game } from '@lib/database';
import { paginate, PaginateQuery, PaginateResult } from 'libs/utils/pagination';

@Injectable()
export class GamesService {
  constructor(
    private readonly msGameService: MsGameService,
    private readonly em: EntityManager,
  ) { }

  async loadGames(data: { siteId: number; params?: any }) {
    return this.msGameService.loadSuperomaticGames(data);
  }

  async getCurrencies(data: { userId: number; siteId: number }) {
    return this.msGameService.superomaticGetCurrencies(data);
  }

  async initGameDemoSession(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticInitDemo(data);
  }

  async initGameSession(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticInitSession(data);
  }

  async gamesFreeRoundsInfo(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticFreeRoundsInfo(data);
  }


  async getGameHistory(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticGetGameHistory(data);
  }

  async getGameStatistics(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticGetGameStatistics(data);
  }

  async getProviderInfo(data: { userId: number; siteId: number; params?: any }) {
    return this.msGameService.superomaticGetProviderInfo(data);
  }


  async closeSession(data: { userId: number; siteId: number; params: any }) {
    return this.msGameService.superomaticCloseSession(data);
  }

  async getGames(query: PaginateQuery): Promise<PaginateResult<Game>> {
    return paginate(
      this.em,
      Game,
      query,
      ['subProvider', 'subProvider.provider', 'categories'], // Relations to populate
      ['name', 'type', 'subProvider.name', 'subProvider.provider.name'] // Searchable fields
    );
  }
}
