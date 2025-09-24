import { Injectable } from '@nestjs/common';
import { SuperomaticUtilsService } from './superomatic.utils.service';
import { SuperomaticApiService } from './superomatic.api.service';
import { ProviderSettingsService } from './provider-settings.service';

@Injectable()
export class SuperomaticService {
  constructor(
    private readonly providerSettings: ProviderSettingsService,
    private readonly api: SuperomaticApiService,
    private readonly utils: SuperomaticUtilsService,
  ) {
    // Initialize any dependencies here
  }

  async loadGames(payload: { userId: number; siteId: number; params?: any }) {
    const { params, siteId } = payload;
    const { baseURL, providerId } =
      await this.providerSettings.getProviderSettings(siteId);

    const gamesList = await this.api.getGames(baseURL);

    let loadGamesCount = 0;
    const deleteGamesCount = 0;

    // TODO: if (params?.isHardReset) delete provider games and set deleteGamesCount
    for (const game of gamesList) {
      const modificatedBody = this.utils.modificationForGameLoad(game);
      // TODO: insert modificatedBody with providerId into DB
      loadGamesCount++;
    }

    // Return raw data expected by ResponseInterceptor
    return { loadGamesCount, deleteGamesCount };
  }

  async getCurrencies(payload: { userId: number; siteId: number }) {
    const { baseURL } = await this.providerSettings.getProviderSettings(
      payload.siteId,
    );
    const response = await this.api.getCurrenciesList(baseURL);
    return response;
  }

  async initGameDemoSession(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { params, siteId } = payload;
    const { baseURL, key } =
      await this.providerSettings.getProviderSettings(siteId);
    const sign = this.utils.generateSigniture(
      params,
      key,
      '/init.demo.session',
    );
    const response = await this.api.getGameDemoSession(baseURL, {
      ...params,
      sign,
    });
    return response;
  }

  async initGameSession(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { params, siteId } = payload;
    const { baseURL, key } =
      await this.providerSettings.getProviderSettings(siteId);
    const sign = this.utils.generateSigniture(params, key, '/init.session');
    const response = await this.api.getGameSession(baseURL, {
      ...params,
      sign,
    });
    return response;
  }

  async gamesFreeRoundsInfo(payload: {
    userId: number;
    siteId: number;
    params: any;
  }) {
    const { params, siteId } = payload;
    const { baseURL, key } =
      await this.providerSettings.getProviderSettings(siteId);
    // In legacy, sign is generated before call
    const sign = this.utils.generateSigniture(params, key, '/freerounds-info');
    const requestBody = { ...params, sign };
    const response = await this.api.gamesFreeRoundsInfo(baseURL, requestBody);
    return response;
  }

  async checkBalance(payload: any) {
    return null;
  }
}
