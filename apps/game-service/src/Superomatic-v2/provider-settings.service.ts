import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameProviderSetting } from '@lib/database';

@Injectable()
export class ProviderSettingsService {
    constructor(private readonly em: EntityManager) { }

    async getProviderSettings(siteId: number) {
        const providerId = 1
        const setting = await this.em.findOne(GameProviderSetting, {
            provider: providerId as any,
            site: siteId as any,
        });

        if (!setting) {
            throw new NotFoundException('Provider settings not found');
        }

        return {
            baseURL: setting.baseURL || '',
            key: setting.key || '',
            providerId,
            partnerAlias: setting.token,
        };
    }
}
