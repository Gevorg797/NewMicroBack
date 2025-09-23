import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameProviderSetting } from '@lib/database';

@Injectable()
export class B2BSlotsProviderSettingsService {
    constructor(private readonly em: EntityManager) { }

    async getProviderSettings(siteId: number) {
        const providerId = Number(process.env.B2BSLOTS_PROVIDER_ID || '0');
        if (!providerId) throw new NotFoundException('B2BSLOTS_PROVIDER_ID env is not set');

        const setting = await this.em.findOne(GameProviderSetting, {
            provider: providerId as any,
            site: siteId as any,
            deletedAt: null,
        });

        if (!setting) throw new NotFoundException('B2BSlots provider settings not found');

        return {
            baseURL: setting.baseURL || '',
            key: setting.key || '',
            providerId,
        };
    }
}


