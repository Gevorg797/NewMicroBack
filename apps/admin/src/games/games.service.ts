import { Injectable } from '@nestjs/common';
import { MsGameService } from 'libs/microservices-clients/ms-game/ms-game.service';
import { EntityManager } from '@mikro-orm/postgresql';
import { Game, GameProvider, GameSubProvider } from '@lib/database';
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

  async getB2BGamesWithProviders() {
    // Find B2BSlots provider
    const b2bProvider = await this.em.findOne(GameProvider, {
      name: { $ilike: '%b2b%' }
    }, { populate: ['subProviders'] });

    if (!b2bProvider) {
      return {};
    }

    const result: any = {};

    // Get all sub-providers for B2B
    const subProviders = await this.em.find(GameSubProvider, {
      provider: b2bProvider.id
    });

    // For each sub-provider, get all games
    for (const subProvider of subProviders) {
      const games = await this.em.find(Game, {
        subProvider: subProvider.id,
        deletedAt: null
      });

      // Convert subProvider name to uppercase key format (e.g., "Play'n GO" -> "PLAYNGO")
      const subProviderKey = subProvider.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Map games with provider name included
      const gamesData = games.map(game => ({
        name: game.name,
        id: game.id,
        provider: b2bProvider.name
      }));

      result[subProviderKey] = gamesData;
    }

    return result;
  }
}
