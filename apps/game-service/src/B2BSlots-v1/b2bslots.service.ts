import { Injectable, Logger } from '@nestjs/common';
import { B2BSlotsProviderSettingsService } from './provider-settings.service';
import { B2BSlotsApiService } from './b2bslots.api.service';
import { B2BSlotsUtilsService } from './b2bslots.utils.service';
import { IGameProvider, ProviderPayload, GameLoadResult } from '../interfaces/game-provider.interface';

@Injectable()
export class B2BSlotsService implements IGameProvider {
  private readonly logger = new Logger(B2BSlotsService.name);
  constructor(
    private readonly settings: B2BSlotsProviderSettingsService,
    private readonly api: B2BSlotsApiService,
    private readonly utils: B2BSlotsUtilsService,
  ) {
    this.logger.log('B2BSlotsService initialized');
  }

  async loadGames(payload: ProviderPayload): Promise<GameLoadResult> {
    this.logger.debug(`Loading games for site: ${payload.siteId}`);

    const { baseURL } = await this.settings.getProviderSettings(payload.siteId);
    const games = await this.api.getGames(baseURL);

    // TODO: map and insert
    const result: GameLoadResult = {
      loadGamesCount: Array.isArray(games) ? games.length : 0,
      deleteGamesCount: 0,
      totalGames: Array.isArray(games) ? games.length : 0,
      games: Array.isArray(games) ? games.slice(0, 10) : [],
    };

    this.logger.debug(`Loaded ${result.loadGamesCount} games from B2BSlots`);
    return result;
  }

  async getCurrencies(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Getting currencies for site: ${payload.siteId}`);

    const { baseURL } = await this.settings.getProviderSettings(payload.siteId);
    const result = await this.api.getCurrencies(baseURL);

    this.logger.debug('Successfully retrieved currencies from B2BSlots');
    return result;
  }

  async initGameDemoSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Initializing demo session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);
    const sign = this.utils.sign(payload.params, key);
    const result = await this.api.initDemo(baseURL, { ...payload.params, sign });

    this.logger.debug('Successfully initialized demo session with B2BSlots');
    return result;
  }

  async initGameSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Initializing game session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);
    const sign = this.utils.sign(payload.params, key);
    const result = await this.api.initSession(baseURL, { ...payload.params, sign });

    this.logger.debug('Successfully initialized game session with B2BSlots');
    return result;
  }

  async gamesFreeRoundsInfo(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Getting free rounds info for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);
    const sign = this.utils.sign(payload.params, key);
    const result = await this.api.freeRoundsInfo(baseURL, { ...payload.params, sign });

    this.logger.debug('Successfully retrieved free rounds info from B2BSlots');
    return result;
  }

  async closeSession(payload: ProviderPayload): Promise<any> {
    this.logger.debug(`Closing session for game: ${payload.params.gameId}`);

    const { baseURL, key } = await this.settings.getProviderSettings(payload.siteId);
    const sign = this.utils.sign(payload.params, key);
    const result = await this.api.closeSession(baseURL, { ...payload.params, sign });

    this.logger.debug('Successfully closed session with B2BSlots');
    return result;
  }
}
