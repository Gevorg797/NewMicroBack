import { Injectable, Logger } from '@nestjs/common';
import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { YoomoneyServcie } from '../yoomoney/yoomoney.service';
import { FreekassaService } from '../freekassa/freekassa.service';
import { CryptobotService } from '../cryptobot/cryptobot.service';
import { PlategaService } from '../platega/platega.service';
import {
  PAYMENT_PROVIDER_NAMES,
  PAYMENT_PROVIDER_IDENTIFIERS,
} from '../constants/provider.constants';
import { UnsupportedProviderException } from '../exceptions/finance-service.exceptions';

/**
 * Factory for creating payment provider strategy instances
 * Implements Strategy pattern to eliminate switch statements and improve extensibility
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);
  private readonly providerMap = new Map<string, IPaymentProvider>();

  constructor(
    private readonly yoomoneyService: YoomoneyServcie,
    private readonly freekassaService: FreekassaService,
    private readonly cryptobotService: CryptobotService,
    private readonly plategaService: PlategaService,
  ) {
    this.initializeProviderMap();
  }

  /**
   * Initialize the provider mapping
   */
  private initializeProviderMap(): void {
    this.providerMap.set(PAYMENT_PROVIDER_NAMES.YOOMONEY, this.yoomoneyService);
    this.providerMap.set(
      PAYMENT_PROVIDER_NAMES.FREEKASSA,
      this.freekassaService,
    );
    this.providerMap.set(
      PAYMENT_PROVIDER_NAMES.CRYPTOBOT,
      this.cryptobotService,
    );
    this.providerMap.set(PAYMENT_PROVIDER_NAMES.PLATEGA, this.plategaService);

    this.logger.log(
      `Initialized ${this.providerMap.size} payment provider strategies`,
    );
  }

  /**
   * Get provider strategy instance
   */
  getProviderStrategy(providerName: string): IPaymentProvider {
    const normalizedName = this.normalizeProviderName(providerName);
    const strategy = this.providerMap.get(normalizedName);

    if (!strategy) {
      this.logger.error(`No strategy found for provider: ${providerName}`);
      throw new UnsupportedProviderException(providerName);
    }

    return strategy;
  }

  /**
   * Normalize provider name to standard identifier
   */
  private normalizeProviderName(providerName: string): string {
    const lowerProviderName = providerName.toLowerCase();

    // Check Yoomoney identifiers
    if (
      PAYMENT_PROVIDER_IDENTIFIERS.YOOMONEY.some((id) =>
        lowerProviderName.includes(id),
      )
    ) {
      return PAYMENT_PROVIDER_NAMES.YOOMONEY;
    }

    // Check Freekassa identifiers
    if (
      PAYMENT_PROVIDER_IDENTIFIERS.FREEKASSA.some((id) =>
        lowerProviderName.includes(id),
      )
    ) {
      return PAYMENT_PROVIDER_NAMES.FREEKASSA;
    }

    // Check Cryptobot identifiers
    if (
      PAYMENT_PROVIDER_IDENTIFIERS.CRYPTOBOT.some((id) =>
        lowerProviderName.includes(id),
      )
    ) {
      return PAYMENT_PROVIDER_NAMES.CRYPTOBOT;
    }

    // Check Platega identifiers
    if (
      PAYMENT_PROVIDER_IDENTIFIERS.PLATEGA.some((id) =>
        lowerProviderName.includes(id),
      )
    ) {
      return PAYMENT_PROVIDER_NAMES.PLATEGA;
    }

    // Return the original name if no match
    return lowerProviderName;
  }

  /**
   * Get all available provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providerMap.keys());
  }
}
