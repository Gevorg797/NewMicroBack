import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { MsFinanceService } from 'libs/microservices-clients/ms-finance/ms-finance.service';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  FinanceTransactions,
  User,
  Balances,
  BalanceType,
  FinanceProviderSettings,
  FinanceProvider,
  FinanceProviderMethods,
  FinanceProviderSubMethods,
  Site,
} from '@lib/database';
import { paginate, PaginateQuery, PaginateResult } from 'libs/utils/pagination';

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);

  constructor(
    private readonly msFinanceService: MsFinanceService,
    private readonly em: EntityManager,
    @InjectRepository(FinanceProviderSettings)
    private readonly providerSettingsRepo: EntityRepository<FinanceProviderSettings>,
  ) {}

  /**
   * Get all provider settings with pagination
   */
  async getProviderSettings(
    query: PaginateQuery,
  ): Promise<PaginateResult<FinanceProviderSettings>> {
    this.logger.debug('Getting provider settings with pagination');

    return paginate(
      this.em,
      FinanceProviderSettings,
      query,
      ['provider', 'site'],
      [],
    );
  }

  /**
   * Get provider settings by ID
   */
  async getProviderSettingsById(id: number) {
    this.logger.debug(`Getting provider settings ${id}`);

    const settings = await this.em.findOne(
      FinanceProviderSettings,
      { id },
      { populate: ['provider', 'site', 'methods'] },
    );

    if (!settings) {
      throw new NotFoundException(`Provider settings with ID ${id} not found`);
    }

    return settings;
  }

  /**
   * Create provider settings
   */
  async createProviderSettings(data: {
    providerId: number;
    siteId: number;
    shopId?: string;
    publicKey?: string;
    privateKey?: string;
    apiKey?: string;
    baseURL?: string;
    paymentFormLink?: string;
    callbackUrl?: string;
    percentage?: number;
  }) {
    this.logger.log(
      `Creating provider settings for provider ${data.providerId}, site ${data.siteId}`,
    );

    const provider = await this.em.findOne(FinanceProvider, {
      id: data.providerId,
    });
    if (!provider) {
      throw new NotFoundException(
        `Provider with ID ${data.providerId} not found`,
      );
    }

    const site = await this.em.findOne(Site, { id: data.siteId });
    if (!site) {
      throw new NotFoundException(`Site with ID ${data.siteId} not found`);
    }

    const settings = this.providerSettingsRepo.create({
      provider,
      site,
      shopId: data.shopId,
      publicKey: data.publicKey,
      privateKey: data.privateKey,
      apiKey: data.apiKey,
      baseURL: data.baseURL!,
      paymentFormLink: data.paymentFormLink,
      callbackUrl: data.callbackUrl,
      percentage: data.percentage || 0,
    });

    await this.em.persistAndFlush(settings);

    this.logger.log(`Provider settings created with ID ${settings.id}`);
    return settings;
  }

  /**
   * Update provider settings
   */
  async updateProviderSettings(
    id: number,
    data: {
      shopId?: string;
      publicKey?: string;
      privateKey?: string;
      apiKey?: string;
      baseURL?: string;
      paymentFormLink?: string;
      callbackUrl?: string;
      percentage?: number;
    },
  ) {
    this.logger.log(`Updating provider settings ${id}`);

    const settings = await this.getProviderSettingsById(id);

    // Update only provided fields
    if (data.shopId !== undefined) settings.shopId = data.shopId;
    if (data.publicKey !== undefined) settings.publicKey = data.publicKey;
    if (data.privateKey !== undefined) settings.privateKey = data.privateKey;
    if (data.apiKey !== undefined) settings.apiKey = data.apiKey;
    if (data.baseURL !== undefined) settings.baseURL = data.baseURL;
    if (data.paymentFormLink !== undefined)
      settings.paymentFormLink = data.paymentFormLink;
    if (data.callbackUrl !== undefined) settings.callbackUrl = data.callbackUrl;
    if (data.percentage !== undefined) settings.percentage = data.percentage;

    await this.em.persistAndFlush(settings);

    this.logger.log(`Provider settings ${id} updated successfully`);
    return settings;
  }

  /**
   * Get provider settings by site
   */
  async getProviderSettingsBySite(siteId: number) {
    this.logger.debug(`Getting provider settings for site ${siteId}`);

    return this.em.find(
      FinanceProviderSettings,
      { site: { id: siteId } },
      { populate: ['provider', 'methods'] },
    );
  }

  /**
   * Get all providers with pagination
   */
  async getProviders(
    query: PaginateQuery,
  ): Promise<PaginateResult<FinanceProvider>> {
    this.logger.debug('Getting providers with pagination');

    return paginate(this.em, FinanceProvider, query, ['settings'], []);
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: number) {
    this.logger.debug(`Getting provider ${id}`);

    const provider = await this.em.findOne(
      FinanceProvider,
      { id },
      { populate: ['settings'] },
    );

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    return provider;
  }

  /**
   * Create provider
   */
  async createProvider(data: { name: string; isEnabled?: boolean }) {
    this.logger.log(`Creating provider: ${data.name}`);

    const provider = this.em.create(FinanceProvider, {
      name: data.name,
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
    });

    await this.em.persistAndFlush(provider);

    this.logger.log(`Provider created with ID ${provider.id}`);
    return provider;
  }

  /**
   * Update provider
   */
  async updateProvider(
    id: number,
    data: { name?: string; isEnabled?: boolean },
  ) {
    this.logger.log(`Updating provider ${id}`);

    const provider = await this.getProviderById(id);

    // Update only provided fields
    if (data.name !== undefined) provider.name = data.name;
    if (data.isEnabled !== undefined) provider.isEnabled = data.isEnabled;

    await this.em.persistAndFlush(provider);

    this.logger.log(`Provider ${id} updated successfully`);
    return provider;
  }

  /**
   * Get all active providers
   */
  async getActiveProviders() {
    this.logger.debug('Getting active providers');

    return this.em.find(
      FinanceProvider,
      { isEnabled: true, deletedAt: null },
      { populate: ['settings'] },
    );
  }

  /**
   * Get all provider methods with pagination
   */
  async getProviderMethods(
    query: PaginateQuery,
  ): Promise<PaginateResult<FinanceProviderMethods>> {
    this.logger.debug('Getting provider methods with pagination');

    return paginate(
      this.em,
      FinanceProviderMethods,
      query,
      ['providerSettings', 'providerSettings.provider', 'subMethods'],
      [],
    );
  }

  /**
   * Get provider method by ID
   */
  async getProviderMethodById(id: number) {
    this.logger.debug(`Getting provider method ${id}`);

    const method = await this.em.findOne(
      FinanceProviderMethods,
      { id },
      {
        populate: [
          'providerSettings',
          'providerSettings.provider',
          'subMethods',
          'image',
        ],
      },
    );

    if (!method) {
      throw new NotFoundException(`Provider method with ID ${id} not found`);
    }

    return method;
  }

  /**
   * Create provider method
   */
  async createProviderMethod(data: {
    providerSettingsId: number;
    name: any;
    value: any;
  }) {
    this.logger.log(`Creating provider method: ${data.name}`);

    const providerSettings = await this.em.findOne(FinanceProviderSettings, {
      id: data.providerSettingsId,
    });

    if (!providerSettings) {
      throw new NotFoundException(
        `Provider settings with ID ${data.providerSettingsId} not found`,
      );
    }

    const method = this.em.create(FinanceProviderMethods, {
      name: data.name,
      value: data.value,
      providerSettings,
    });

    await this.em.persistAndFlush(method);

    this.logger.log(`Provider method created with ID ${method.id}`);
    return method;
  }

  /**
   * Update provider method
   */
  async updateProviderMethod(id: number, data: { name?: any; value?: any }) {
    this.logger.log(`Updating provider method ${id}`);

    const method = await this.getProviderMethodById(id);

    // Update only provided fields
    if (data.name !== undefined) method.name = data.name;
    if (data.value !== undefined) method.value = data.value;

    await this.em.persistAndFlush(method);

    this.logger.log(`Provider method ${id} updated successfully`);
    return method;
  }

  /**
   * Get provider methods by settings ID
   */
  async getProviderMethodsBySettings(providerSettingsId: number) {
    this.logger.debug(
      `Getting provider methods for settings ${providerSettingsId}`,
    );

    return this.em.find(
      FinanceProviderMethods,
      { providerSettings: { id: providerSettingsId } },
      { populate: ['subMethods', 'image'] },
    );
  }

  /**
   * Get all sub methods with pagination
   */
  async getSubMethods(
    query: PaginateQuery,
  ): Promise<PaginateResult<FinanceProviderSubMethods>> {
    this.logger.debug('Getting sub methods with pagination');

    return paginate(
      this.em,
      FinanceProviderSubMethods,
      query,
      ['method', 'method.providerSettings', 'method.providerSettings.provider'],
      [],
    );
  }

  /**
   * Get sub method by ID
   */
  async getSubMethodById(id: number) {
    this.logger.debug(`Getting sub method ${id}`);

    const subMethod = await this.em.findOne(
      FinanceProviderSubMethods,
      { id },
      {
        populate: [
          'method',
          'method.providerSettings',
          'method.providerSettings.provider',
        ],
      },
    );

    if (!subMethod) {
      throw new NotFoundException(`Sub method with ID ${id} not found`);
    }

    return subMethod;
  }

  /**
   * Create sub method
   */
  async createSubMethod(data: {
    methodId: number;
    siteId: number;
    type: any;
    minAmount?: number;
    maxAmount?: number;
    isEnabled?: boolean;
  }) {
    this.logger.log(`Creating sub method for method ${data.methodId}`);

    const method = await this.em.findOne(FinanceProviderMethods, {
      id: data.methodId,
    });

    if (!method) {
      throw new NotFoundException(`Method with ID ${data.methodId} not found`);
    }

    const site = await this.em.findOne(Site, { id: data.siteId });
    if (!site) {
      throw new NotFoundException(`Site with ID ${data.siteId} not found`);
    }

    const subMethod = this.em.create(FinanceProviderSubMethods, {
      method,
      site,
      type: data.type,
      minAmount: data.minAmount || 0,
      maxAmount: data.maxAmount || 0,
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
    });

    await this.em.persistAndFlush(subMethod);

    this.logger.log(`Sub method created with ID ${subMethod.id}`);
    return subMethod;
  }

  /**
   * Update sub method
   */
  async updateSubMethod(
    id: number,
    data: {
      type?: any;
      minAmount?: number;
      maxAmount?: number;
      isEnabled?: boolean;
    },
  ) {
    this.logger.log(`Updating sub method ${id}`);

    const subMethod = await this.getSubMethodById(id);

    // Update only provided fields
    if (data.type !== undefined) subMethod.type = data.type;
    if (data.minAmount !== undefined) subMethod.minAmount = data.minAmount;
    if (data.maxAmount !== undefined) subMethod.maxAmount = data.maxAmount;
    if (data.isEnabled !== undefined) subMethod.isEnabled = data.isEnabled;

    await this.em.persistAndFlush(subMethod);

    this.logger.log(`Sub method ${id} updated successfully`);
    return subMethod;
  }

  /**
   * Get sub methods by method ID
   */
  async getSubMethodsByMethod(methodId: number) {
    this.logger.debug(`Getting sub methods for method ${methodId}`);

    return this.em.find(
      FinanceProviderSubMethods,
      { method: { id: methodId } },
      { populate: ['method'] },
    );
  }
}
