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

  async loadB2BSlotsGames(data: { siteId: number; params?: any }) {
    return this.msGameService.loadB2BSlotsGames(data);
  }

  // Note: These methods now use unified routing based on gameId from params
  async initGameDemoSession(data: { userId: number; siteId: number; gameId: number; balanceType?: any; params: any }) {
    return this.msGameService.initGameDemoSession({
      userId: data.userId,
      siteId: data.siteId,
      gameId: data.gameId,
      balanceType: data.balanceType,
      params: data.params
    });
  }

  async initGameSession(data: { userId: number; siteId: number; gameId: number; balanceType?: any; params: any }) {
    return this.msGameService.initGameSession({
      userId: data.userId,
      siteId: data.siteId,
      gameId: data.gameId,
      balanceType: data.balanceType,
      params: data.params
    });
  }

  async gamesFreeRoundsInfo(data: { userId: number; siteId: number; gameId: number; balanceType?: any; params: any }) {
    return this.msGameService.gamesFreeRoundsInfo({
      userId: data.userId,
      siteId: data.siteId,
      gameId: data.gameId,
      balanceType: data.balanceType,
      params: data.params
    });
  }

  async closeSession(data: { userId: number; siteId?: number; gameId?: number; params?: any }) {
    return this.msGameService.closeSession({
      userId: data.userId,
      siteId: data.siteId,
      gameId: data.gameId,
      params: data.params
    });
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
