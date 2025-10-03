import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameProviderSetting } from '@lib/database';
import { ProviderSettings } from '../interfaces/game-provider.interface';
import { ProviderSettingsNotFoundException } from '../exceptions/game-service.exceptions';

@Injectable()
export class ProviderSettingsService {
    private readonly logger = new Logger(ProviderSettingsService.name);

    constructor(private readonly em: EntityManager) {
        this.logger.log('SuperomaticProviderSettingsService initialized');
    }

    async getProviderSettings(siteId: number): Promise<ProviderSettings & { partnerAlias?: string }> {
        this.logger.debug(`Getting Superomatic provider settings for site: ${siteId}`);

        const providerId = 1; // Superomatic provider ID
        const setting = await this.em.findOne(GameProviderSetting, {
            provider: providerId as any,
            site: siteId as any,
        });

        if (!setting) {
            this.logger.error(`Superomatic provider settings not found for site: ${siteId}`);
            throw new ProviderSettingsNotFoundException('Superomatic');
        }

        this.logger.debug(`Successfully retrieved Superomatic provider settings for site: ${siteId}`);
        return {
            baseURL: setting.baseURL || '',
            key: setting.key || '',
            providerId,
            partnerAlias: setting.token,
        };
    }
}
