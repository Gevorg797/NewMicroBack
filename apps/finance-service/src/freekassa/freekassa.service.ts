import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePayinOrderDto } from './dto/create-payin-order.dto';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  BalanceType,
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import * as crypto from 'crypto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';
import {
  IPaymentProvider,
  PaymentPayload,
  PayoutPayload,
  CallbackPayload,
  PaymentResult,
} from '../interfaces/payment-provider.interface';
import { TransactionManagerService } from '../repository/transaction-manager.service';

@Injectable()
export class FreekassaService implements IPaymentProvider {
  balancesRepository: any;
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionRepo: EntityRepository<FinanceTransactions>,
    readonly transactionManager: TransactionManagerService,
  ) {}

  async createPayinOrder(payload: PaymentPayload): Promise<PaymentResult> {
    const { transactionId, amount } = payload;

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

    const paymentUrl = `${transaction.subMethod.method.providerSettings.paymentFormLink}?m=${shopId}&oa=${orderAmount}&o=${orderId}&s=${sign}&currency=${currencyCode}`;

    return { paymentUrl };
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

  async createPayoutProcess(payload: PayoutPayload): Promise<any> {
    // Freekassa doesn't support automated payouts yet
    throw new Error('Freekassa does not support automated payouts');
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    const body = payload.body;
    const ipAddress = payload.params?.ipAddress;
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

    const transaction = await this.transactionManager.getTransaction(
      Number(MERCHANT_ORDER_ID),
      ['subMethod.method.providerSettings', 'user', 'currency'],
    );

    this.transactionManager.validateTransactionNotProcessed(transaction);

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

    await this.transactionManager.completePayin(
      transaction.id as number,
      AMOUNT,
      intid || 'freekassa-' + transaction.id,
    );
  }
}
