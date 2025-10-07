import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
  Balances,
  BalanceType,
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

@Injectable()
export class CryptobotService {
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionsRepo: EntityRepository<FinanceTransactions>,
    @InjectRepository(Balances)
    readonly balancesRepository: EntityRepository<Balances>,
  ) {}

  async createPayinOrder(body: any) {
    const { transactionId, amount } = body;

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

    let reqBody: any = {
      amount,
    };

    const providerSettings = transaction?.subMethod.method.providerSettings;

    if (!providerSettings) {
      throw new NotFoundException('Provider settings not found');
    }

    let availableСurrencies: any;

    if (transaction?.subMethod.method.value === 'fiat') {
      availableСurrencies = [
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

      if (!availableСurrencies.includes(transaction.currency.name)) {
        throw new NotFoundException(
          `Currency ${transaction.currency.name} is not supported in method ${transaction?.subMethod.method.value}`,
        );
      }

      reqBody.fiat = transaction.currency.name;
    } else if (transaction?.subMethod.method.value === 'crypto') {
      availableСurrencies = [
        'USDT',
        'TON',
        'BTC',
        'ETH',
        'LTC',
        'BNB',
        'TRX',
        'USDC',
      ];

      if (!availableСurrencies.includes(transaction.currency.name)) {
        throw new NotFoundException(
          `Currency ${transaction.currency.name} is not supported in method ${transaction?.subMethod.method.value}`,
        );
      }

      reqBody.asset = transaction.currency.name;
    }

    try {
      const response = await axios.post(
        `${providerSettings.baseURL as string}createInvoice`,
        reqBody,
        {
          headers: {
            'Crypto-Pay-API-Token': providerSettings.apiKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      const providerMessage = error.response?.data?.message || error.message;
      throw new BadRequestException(
        `Cryptobot request failed: ${providerMessage}`,
      );
    }
  }

  async createPayoutProcess(body: any) {
    const { transactionId, amount } = body;

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

    const providerSettings = transaction?.subMethod.method.providerSettings;

    if (!providerSettings) {
      throw new NotFoundException('Provider settings not found');
    }

    if (!transaction) {
      throw new NotFoundException('transaction not found');
    }

    const reqBody = {
      user_id: transaction?.user.telegramId,
      asset: transaction.currency.name,
      amount,
      spend_id: transaction.id,
    };

    try {
      const response = await axios.post(
        `
                ${transaction?.subMethod.method.providerSettings.baseURL as string}transfer`,
        reqBody,
        {
          headers: {
            'Crypto-Pay-API-Token':
              transaction?.subMethod.method.providerSettings.apiKey,
          },
        },
      );

      transaction.paymentTransactionId = response.data.invoice_id;
      await this.financeTransactionsRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      return response.data;
    } catch (error) {
      const providerMessage = error.response.data.error.name || error.message;
      throw new NotFoundException(
        `Cryptobot request failed: ${providerMessage}`,
      );
    }
  }

  async handleCallback(body: any, headers: any) {
    const { payload } = body;

    const transaction = await this.financeTransactionsRepo.findOne(
      { paymentTransactionId: payload.invoice_id },
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

    if (
      !this.checkSignature(
        transaction?.subMethod.method.providerSettings.apiKey as string,
        payload,
        headers,
      )
    ) {
      throw new BadRequestException('hack attempt');
    }

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
