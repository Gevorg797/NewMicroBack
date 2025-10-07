import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePayinOrderDto } from './dto/create-payin-order.dto';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
  Balances,
  BalanceType,
} from '@lib/database';
import * as crypto from 'crypto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';

@Injectable()
export class FreekassaService {
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionRepo: EntityRepository<FinanceTransactions>,
    @InjectRepository(Balances)
    readonly balancesRepository: EntityRepository<Balances>,
  ) {}

  async createPayinOrder(body: CreatePayinOrderDto) {
    const { transactionId, amount } = body;

    const transaction = await this.financeTransactionRepo.findOne(
      { id: transactionId },
      {
        populate: ['currency', 'subMethod.method.providerSettings'],
      },
    );

    if (!transaction) {
      throw new NotFoundException('transaction not found');
    }

    if (!transaction.subMethod.method.providerSettings) {
      throw new NotFoundException('Provider not found');
    }

    const shopId = transaction.subMethod.method.providerSettings
      .shopId as string;
    const orderId = transactionId.toString();
    const orderAmount = amount.toString();
    const currencyCode = transaction.currency.name;
    const secretWord = transaction.subMethod.method.providerSettings
      .publicKey as string;

    const sign = this.generateFormSignature(
      shopId,
      orderAmount,
      secretWord,
      currencyCode,
      orderId,
    );

    const url = `${transaction.subMethod.method.providerSettings.paymentFormLink}?m=${shopId}&oa=${orderAmount}&o=${orderId}&s=${sign}&currency=${currencyCode}`;

    return { url };
  }

  private generateSignature(data: any, key: string) {
    const sortedKeys = Object.keys(data).sort();

    const sortedValues = sortedKeys.map((key) => data[key]);

    const signString = sortedValues.join('|');

    return crypto.createHmac('sha256', key).update(signString).digest('hex');
  }

  private generateFormSignature(
    shopId: string,
    amount: string,
    secret: string,
    currency: string,
    orderId: string,
  ): string {
    const signString = `${shopId}:${amount}:${secret}:${currency}:${orderId}`;
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  async handleCallback(body: any, ipAddress: string) {
    const { MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, SIGN, intid } = body;

    const allowedIps = [
      '168.119.157.136',
      '168.119.60.227',
      '178.154.197.79',
      '51.250.54.238',
    ];

    if (ipAddress && !allowedIps.includes(ipAddress)) {
      throw new Error('hacking attempt!');
    }

    const transaction = await this.financeTransactionRepo.findOne(
      { id: Number(MERCHANT_ORDER_ID) },
      {
        populate: ['subMethod.method.providerSettings', 'user', 'currency'],
      },
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (
      transaction.status === PaymentTransactionStatus.COMPLETED ||
      transaction.status === PaymentTransactionStatus.FAILED
    ) {
      throw new NotFoundException(
        'Transaction already processed, return early',
      );
    }

    if (transaction.amount !== parseFloat(AMOUNT)) {
      throw new Error('Amount mismatch');
    }

    const generateSign = this.generateFormSignature(
      MERCHANT_ID,
      AMOUNT,
      transaction.subMethod.method.providerSettings.publicKey as string,
      transaction.currency.name,
      (transaction.id as number).toString(),
    );

    if (generateSign.toUpperCase() !== SIGN.toUpperCase()) {
      throw new Error('wrong sign');
    }

    // Get main balance to credit the amount
    const mainBalance = await this.balancesRepository.findOne({
      user: transaction.user,
      type: BalanceType.MAIN,
    });

    if (!mainBalance) {
      throw new Error('Main balance not found for user');
    }

    transaction.status = PaymentTransactionStatus.COMPLETED;
    transaction.paymentTransactionId = intid || null;
    mainBalance.balance += AMOUNT;

    await this.financeTransactionRepo
      .getEntityManager()
      .persistAndFlush([transaction, mainBalance]);

    return 'YES';
  }
}
