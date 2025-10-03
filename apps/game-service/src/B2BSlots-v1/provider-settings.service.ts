import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameProviderSetting } from '@lib/database';
import { ProviderSettings } from '../interfaces/game-provider.interface';
import {
  ProviderSettingsNotFoundException,
  ProviderConfigurationException
} from '../exceptions/game-service.exceptions';

@Injectable()
export class B2BSlotsProviderSettingsService {
  private readonly logger = new Logger(B2BSlotsProviderSettingsService.name);

  constructor(private readonly em: EntityManager) {
    this.logger.log('B2BSlotsProviderSettingsService initialized');
  }

  async getProviderSettings(siteId: number): Promise<ProviderSettings> {
    this.logger.debug(`Getting B2BSlots provider settings for site: ${siteId}`);

    const providerId = Number(process.env.B2BSLOTS_PROVIDER_ID || '0');
    if (!providerId) {
      this.logger.error('B2BSLOTS_PROVIDER_ID environment variable is not set');
      throw new ProviderConfigurationException('B2BSLOTS_PROVIDER_ID');
    }

    const setting = await this.em.findOne(GameProviderSetting, {
      provider: providerId as any,
      site: siteId as any,
      deletedAt: null,
    });

    if (!setting) {
      this.logger.error(`B2BSlots provider settings not found for site: ${siteId}`);
      throw new ProviderSettingsNotFoundException('B2BSlots');
    }

    this.logger.debug(`Successfully retrieved B2BSlots provider settings for site: ${siteId}`);
    return {
      baseURL: setting.baseURL || '',
      key: setting.key || '',
      providerId,
    };
  }
}
