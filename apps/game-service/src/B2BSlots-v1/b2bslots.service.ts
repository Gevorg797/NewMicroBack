import { Injectable } from '@nestjs/common';
import { B2BSlotsProviderSettingsService } from './provider-settings.service';
import { B2BSlotsApiService } from './b2bslots.api.service';
import { B2BSlotsUtilsService } from './b2bslots.utils.service';

@Injectable()
export class B2BSlotsService {
  constructor(
    private readonly settings: B2BSlotsProviderSettingsService,
    private readonly api: B2BSlotsApiService,
    private readonly utils: B2BSlotsUtilsService,
  ) {}

  async loadGames(payload: { userId: number; siteId: number; params?: any }) {
    const { baseURL } = await this.settings.getProviderSettings(payload.siteId);
    const games = await this.api.getGames(baseURL);
    // TODO: map and insert
    return {
      loadGamesCount: Array.isArray(games) ? games.length : 0,
      deleteGamesCount: 0,
    };
  }

  async getCurrencies(payload: { userId: number; siteId: number }) {
    const { baseURL } = await this.settings.getProviderSettings(payload.siteId);
    return this.api.getCurrencies(baseURL);
  }

  async initGameDemoSession(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { baseURL, key } = await this.settings.getProviderSettings(
      payload.siteId,
    );
    const sign = this.utils.sign(payload.params, key);
    return this.api.initDemo(baseURL, { ...payload.params, sign });
  }

  async initGameSession(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { baseURL, key } = await this.settings.getProviderSettings(
      payload.siteId,
    );
    const sign = this.utils.sign(payload.params, key);
    return this.api.initSession(baseURL, { ...payload.params, sign });
  }

  async gamesFreeRoundsInfo(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { baseURL, key } = await this.settings.getProviderSettings(
      payload.siteId,
    );
    const sign = this.utils.sign(payload.params, key);
    return this.api.freeRoundsInfo(baseURL, { ...payload.params, sign });
  }
}
