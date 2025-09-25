import { Injectable } from '@nestjs/common';
import { SuperomaticUtilsService } from './superomatic.utils.service';
import { SuperomaticApiService } from './superomatic.api.service';
import { ProviderSettingsService } from './provider-settings.service';
import { EntityManager } from '@mikro-orm/postgresql';
import { wrap } from '@mikro-orm/core';
import { Game, GameProvider, GameSubProvider } from '@lib/database';

@Injectable()
export class SuperomaticService {
    constructor(
        private readonly providerSettings: ProviderSettingsService,
        private readonly api: SuperomaticApiService,
        private readonly utils: SuperomaticUtilsService,
        private readonly em: EntityManager,
    ) {
        // Initialize any dependencies here
    }

    async loadGames(payload: { siteId: number; params?: any }) {
        const { params, siteId } = payload;
        const { baseURL, providerId } =
            await this.providerSettings.getProviderSettings(siteId);

        // Call Superomatic API with proper parameters
        const apiResponse = await this.api.getGames(baseURL, params);

        // Extract games from Superomatic API response
        const gamesList: Array<any> = (apiResponse?.games || apiResponse?.response || []);

        let loadGamesCount = 0;
        let deleteGamesCount = 0;

        const providerRef = await this.em.findOneOrFail(GameProvider, { id: providerId });

        // Hard reset: delete games and sub-providers of this provider
        if (params?.isHardReset) {
            const subProviders = await this.em.find(GameSubProvider, { provider: providerRef });
            for (const sp of subProviders) {
                const toDelete = await this.em.find(Game, { subProvider: sp });
                deleteGamesCount += toDelete.length;
                await this.em.removeAndFlush(toDelete);
            }
            // Remove sub-providers after removing games
            // await this.em.removeAndFlush(subProviders);
        }

        for (const game of gamesList) {
            const groupName: string = game.group || 'default';
            let subProvider = await this.em.findOne(GameSubProvider, { name: groupName, provider: providerRef });
            if (!subProvider) {
                subProvider = new GameSubProvider();
                wrap(subProvider).assign({ name: groupName, provider: providerRef });
                await this.em.persistAndFlush(subProvider);
            }

            // Upsert by superomatic id as uuid
            const existing = await this.em.findOne(Game, { uuid: String(game.id) });
            if (existing) {
                wrap(existing).assign({
                    name: game.title,
                    type: game.type,
                    image: game.icon,
                    subProvider,
                    metadata: { provider: game.provider, isEnabled: game.is_enabled },
                },);
                await this.em.flush();
            } else {
                const newGame = new Game();
                wrap(newGame).assign({
                    name: game.title,
                    uuid: String(game.id),
                    type: game.type,
                    technology: 'html5',
                    isHasLobby: false,
                    isMobile: true,
                    isHasFreeSpins: true,
                    isHasTables: false,
                    isFreeSpinValidUntilFullDay: false,
                    isDesktop: true,
                    image: game.icon,
                    subProvider,
                    metadata: { provider: game.provider, isEnabled: game.is_enabled },
                },);
                await this.em.persistAndFlush(newGame);
            }

            loadGamesCount++;
        }

        // Return raw data expected by ResponseInterceptor
        return {
            loadGamesCount,
            deleteGamesCount,
            totalGames: gamesList.length,
            games: gamesList.slice(0, 10) // Return first 10 games as sample
        };
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
