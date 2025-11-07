import {
  Balances,
  BalanceType,
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { createHash, createHmac } from 'crypto';
import {
  IPaymentProvider,
  PaymentPayload,
  PayoutPayload,
  CallbackPayload,
  PaymentResult,
} from '../interfaces/payment-provider.interface';
import { TransactionManagerService } from '../repository/transaction-manager.service';
import { PaymentNotificationService } from '../notifications/payment-notification.service';

@Injectable()
export class CryptobotService implements IPaymentProvider {
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(Balances)
    readonly balancesRepository: EntityRepository<Balances>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionsRepo: EntityRepository<FinanceTransactions>,
    readonly transactionManager: TransactionManagerService,
    private readonly notificationService: PaymentNotificationService,
  ) {}

  async createPayinOrder(payload: PaymentPayload): Promise<PaymentResult> {
    const { transactionId, amount } = payload;

    const transaction = await this.financeTransactionsRepo.findOne(
      { id: transactionId },
      {
        populate: [
          'subMethod.method',
          'currency',
          'subMethod.method.providerSettings',
        ],
      },
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const providerSettings = transaction?.subMethod.method.providerSettings;

    if (!providerSettings) {
      throw new NotFoundException('Provider settings not found');
    }

    // Build request body according to Crypto Pay API docs
    let reqBody: any = {
      amount: amount.toString(), // Amount must be string according to API docs
    };

    // Supported currencies
    const fiatCurrencies = [
      'USD',
      'EUR',
      'RUB',
      'BYN',
      'UAH',
      'GBP',
      'CNY',
      'KZT',
      'UZS',
      'GEL',
      'TRY',
      'AMD',
      'THB',
      'INR',
      'BRL',
      'IDR',
      'AZN',
      'AED',
      'PLN',
      'ILS',
    ];

    const cryptoCurrencies = [
      'USDT',
      'TON',
      'BTC',
      'ETH',
      'LTC',
      'BNB',
      'TRX',
      'USDC',
    ];

    const currencyName = transaction.currency.name;
    const methodValue = transaction?.subMethod?.method?.value;

    // Determine currency type based on method value or currency name
    if (methodValue === 'fiat' || fiatCurrencies.includes(currencyName)) {
      // Fiat currency type
      if (!fiatCurrencies.includes(currencyName)) {
        throw new BadRequestException(
          `Currency ${currencyName} is not a supported fiat currency. Supported: ${fiatCurrencies.join(', ')}`,
        );
      }

      reqBody.currency_type = 'fiat';
      reqBody.fiat = currencyName;
      // Optional: accepted_assets - specify which crypto assets can be used to pay
      reqBody.accepted_assets = 'USDT,TON,BTC,ETH,LTC,BNB,TRX,USDC';
    } else if (
      methodValue === 'crypto' ||
      cryptoCurrencies.includes(currencyName)
    ) {
      // Crypto currency type
      if (!cryptoCurrencies.includes(currencyName)) {
        throw new BadRequestException(
          `Currency ${currencyName} is not a supported cryptocurrency. Supported: ${cryptoCurrencies.join(', ')}`,
        );
      }

      reqBody.currency_type = 'crypto';
      reqBody.asset = currencyName;
    } else {
      // Neither fiat nor crypto - throw error
      throw new BadRequestException(
        `Currency ${currencyName} is not supported. Method value: ${methodValue}. Supported crypto: ${cryptoCurrencies.join(', ')}. Supported fiat: ${fiatCurrencies.join(', ')}`,
      );
    }

    // Use default mainnet URL if baseURL is not configured
    let baseURL = providerSettings.baseURL as string;

    try {
      const response = await axios.post(`${baseURL}/createInvoice`, reqBody, {
        headers: {
          'Crypto-Pay-API-Token': providerSettings.apiKey,
          'Content-Type': 'application/json',
        },
      });

      // Check API response structure according to docs
      if (!response.data.ok) {
        throw new BadRequestException(
          `Cryptobot API error: ${response.data.error?.name || 'Unknown error'}`,
        );
      }

      // Store invoice_id in transaction for callback handling
      const invoice = response.data.result;
      transaction.paymentTransactionId = invoice.invoice_id.toString();
      await this.financeTransactionsRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      // Return the invoice URL for payment
      return {
        paymentUrl: invoice.bot_invoice_url || invoice.pay_url,
        invoiceId: invoice.invoice_id.toString(),
        ...invoice,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const providerMessage =
        error.response?.data?.error?.name ||
        error.response?.data?.message ||
        error.message;
      throw new BadRequestException(
        `Cryptobot request failed: ${providerMessage}`,
      );
    }
  }

  /**
   * Process crypto payout (withdrawal) - Similar to Python's get_check()
   * Creates a CryptoBot check that user can claim
   */
  async createPayoutProcess(payload: PayoutPayload): Promise<any> {
    console.log('crptobot', payload);

    const { transactionId, amount } = payload;

    // Get transaction with all required relations
    const transaction = await this.financeTransactionsRepo.findOne(
      { id: transactionId },
      {
        populate: [
          'subMethod.method',
          'currency',
          'subMethod.method.providerSettings',
          'user',
        ],
      },
    );

    if (!transaction) {
      return { error: 'Transaction not found' };
    }

    const providerSettings = transaction?.subMethod.method.providerSettings;
    if (!providerSettings) {
      return { error: 'Provider settings not found' };
    }

    if (!transaction.user?.telegramId) {
      return { error: 'User telegram ID not found' };
    }

    // Get exchange rate and convert RUB to USDT
    const exchangeRate = await this.getExchangeRate(
      'USDT',
      transaction.currency.name,
      providerSettings,
    );
    const usdtAmount = amount / exchangeRate;

    // Create check (like Python's get_check function)
    const check = await this.createCheck(
      usdtAmount,
      transaction.user.telegramId,
      transaction.id as number,
      providerSettings,
    );

    // Update transaction
    transaction.paymentTransactionId = check.check_id?.toString();
    transaction.status = PaymentTransactionStatus.COMPLETED;
    transaction.requisite = check.bot_check_url; // Store check URL in requisite
    await this.financeTransactionsRepo
      .getEntityManager()
      .persistAndFlush(transaction);

    return {
      id: transaction.id,
      check_id: check.check_id,
      check_url: check.bot_check_url,
      amount_rub: amount,
      amount_usdt: usdtAmount.toFixed(2),
      exchange_rate: exchangeRate,
    };
  }

  /**
   * Get exchange rate - Similar to Python's calc_rub_to_usdt logic
   */
  private async getExchangeRate(
    source: string,
    target: string,
    providerSettings: any,
  ): Promise<number> {
    const baseURL =
      (providerSettings.baseURL as string) || 'https://pay.crypt.bot/api';
    const apiURL = baseURL.replace(/\/$/, '').endsWith('/api')
      ? baseURL.replace(/\/$/, '')
      : `${baseURL.replace(/\/$/, '')}/api`;

    try {
      const response = await axios.get(`${apiURL}/getExchangeRates`, {
        headers: {
          'Crypto-Pay-API-Token': providerSettings.apiKey,
        },
        params: { source, target },
      });

      if (response.data.ok && response.data.result.length > 0) {
        return parseFloat(response.data.result[0].rate);
      }

      throw new Error('Exchange rate not available');
    } catch (error) {
      console.error('❌ Exchange rate error:', error.response?.data || error);
      throw new BadRequestException(
        `Failed to get exchange rate: ${error.message}`,
      );
    }
  }

  /**
   * Create CryptoBot Check - Similar to Python's get_check()
   * Creates a check URL that user clicks to claim funds
   * https://help.send.tg/en/articles/10279948-crypto-pay-api
   */
  private async createCheck(
    usdtAmount: number,
    userId: string,
    transactionId: number,
    providerSettings: any,
  ): Promise<any> {
    const baseURL =
      (providerSettings.baseURL as string) || 'https://pay.crypt.bot/api';
    const apiURL = baseURL.replace(/\/$/, '').endsWith('/api')
      ? baseURL.replace(/\/$/, '')
      : `${baseURL.replace(/\/$/, '')}/api`;

    const reqBody = {
      asset: 'USDT',
      amount: usdtAmount.toFixed(2),
      pin_to_user_id: Number(userId), // Pin check to specific user
      description: `💎 Вывод #${transactionId} | Бот - @BikBet_bot`,
    };

    console.log('🚀 CryptoBot createCheck:', reqBody);

    try {
      const response = await axios.post(`${apiURL}/createCheck`, reqBody, {
        headers: {
          'Crypto-Pay-API-Token': providerSettings.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.data.ok) {
        throw new BadRequestException(
          `CryptoBot API error: ${response.data.error?.name || 'Unknown error'}`,
        );
      }

      return response.data.result;
    } catch (error) {
      console.error(
        '❌ CryptoBot createCheck error:',
        error.response?.data || error,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error.response?.data?.error?.name ||
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;

      throw new BadRequestException(
        `CryptoBot check creation failed: ${errorMessage}`,
      );
    }
  }

  async handleCallback(callbackPayload: CallbackPayload): Promise<void> {
    const { body, headers } = callbackPayload;
    const { payload } = body;

    const transaction = await this.financeTransactionsRepo.findOne(
      { paymentTransactionId: String(payload.invoice_id) },
      {
        populate: [
          'subMethod.method',
          'subMethod.method.providerSettings',
          'user',
        ],
      },
    );

    if (!transaction) {
      throw new NotFoundException('transaction not found');
    }

    // if (
    //   !this.checkSignature(
    //     transaction?.subMethod.method.providerSettings.apiKey as string,
    //     payload,
    //     headers,
    //   )
    // ) {
    //   throw new BadRequestException('hack attempt');
    // }

    if (
      transaction.status === PaymentTransactionStatus.COMPLETED ||
      transaction.status === PaymentTransactionStatus.FAILED
    ) {
      throw new NotFoundException(
        'Transaction already processed, return early',
      );
    }

    if (transaction.amount !== parseFloat(payload.amount)) {
      throw new Error('Amount mismatch');
    }

    // Get main balance to credit the amount
    const mainBalance = await this.balancesRepository.findOne({
      user: transaction.user,
      type: BalanceType.MAIN,
    });

    if (!mainBalance) {
      throw new Error('Main balance not found for user');
    }

    mainBalance.balance += payload.amount;
    transaction.status = PaymentTransactionStatus.COMPLETED;

    await this.financeTransactionsRepo
      .getEntityManager()
      .persistAndFlush([transaction, mainBalance]);
  }

  private checkSignature(token: string, body: any, headers: any) {
    const secret = createHash('sha256').update(token).digest();
    const checkString = JSON.stringify(body);
    const hmac = createHmac('sha256', secret).update(checkString).digest('hex');
    return hmac === headers['crypto-pay-api-signature'];
  }
}
