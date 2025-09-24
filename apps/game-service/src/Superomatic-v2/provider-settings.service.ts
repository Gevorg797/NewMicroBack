import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { GameProviderSetting } from '@lib/database';

@Injectable()
export class ProviderSettingsService {
  constructor(private readonly em: EntityManager) {}

  async getProviderSettings(siteId: number) {
    const providerId = Number(process.env.SUPEROMATIC_PROVIDER_ID || '0');
    if (!providerId) {
      throw new NotFoundException('SUPEROMATIC_PROVIDER_ID env is not set');
    }
    const setting = await this.em.findOne(GameProviderSetting, {
      provider: providerId as any,
      site: siteId as any,
      deletedAt: null,
    });

    if (!setting) {
      throw new NotFoundException('Provider settings not found');
    }

    return {
      baseURL: setting.baseURL || '',
      key: setting.key || '',
      providerId,
    };
  }
}
