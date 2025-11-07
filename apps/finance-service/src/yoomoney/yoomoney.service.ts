import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { YooMoneyCallbackDto } from './dto/handle-callback.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
} from '@lib/database';
import { EntityRepository } from '@mikro-orm/postgresql';
import * as crypto from 'crypto';
import axios from 'axios';
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
export class YoomoneyServcie implements IPaymentProvider {
  constructor(
    @InjectRepository(FinanceProviderSettings)
    readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(Currency)
    readonly currencyRepository: EntityRepository<Currency>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionRepo: EntityRepository<FinanceTransactions>,
    readonly transactionManager: TransactionManagerService,
    readonly notificationService: PaymentNotificationService,
  ) {}

  async createPayinOrder(payload: PaymentPayload): Promise<PaymentResult> {
    const { transactionId, amount } = payload;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      [
        'subMethod.method.providerSettings',
        'subMethod.method.providerSettings.provider',
        'subMethod.method',
        'user',
      ],
    );

    const providerSettings = transaction?.subMethod.method.providerSettings;
    const url = transaction?.subMethod.method.providerSettings.paymentFormLink;

    const paymentUrl = `${url}?receiver=${providerSettings.shopId}&quickpay-form=shop&paymentType=${transaction.subMethod.method.value}&sum=${amount}&label=${transaction.id}`;

    return { paymentUrl };
  }

  async createPayoutProcess(payload: PayoutPayload): Promise<any> {
    const { transactionId, amount, params } = payload;
    const to = params?.to || payload.to;

    const transaction = await this.transactionManager.getTransaction(
      transactionId,
      ['subMethod.method.providerSettings'],
    );

    const providerSettings = transaction.subMethod.method.providerSettings;
    const accessToken = providerSettings.publicKey as string;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const reqParams = new URLSearchParams({
      pattern_id: 'p2p',
      to: to || '',
      amount_due: amount.toString(),
      comment: `Withdrawal tx:${transaction.id}`,
      label: transactionId.toString(),
    });

    try {
      const { data: requestData } = await axios.post(
        `${providerSettings.baseURL}?request-payment`,
        reqParams,
        {
          headers,
        },
      );

      if (requestData.status !== 'success') {
        await this.transactionManager.failTransaction(
          transactionId,
          requestData.error,
        );
        throw new BadRequestException(
          `request-payment failed: ${requestData.error}`,
        );
      }

      const procParams = new URLSearchParams({
        request_id: requestData.request_id,
      });

      const { data: processData } = await axios.post(
        `${providerSettings.baseURL}process-payment`,
        procParams,
        {
          headers,
        },
      );

      if (processData.status === 'success') {
        await this.transactionManager.completePayout(
          transactionId,
          processData.payment_id,
        );
      } else {
        throw new BadRequestException(
          `process-payment failed: ${processData.error}`,
        );
      }

      return processData;
    } catch (error) {
      await this.transactionManager.failTransaction(
        transactionId,
        error.message,
      );

      const providerMessage = error.response?.data?.error.name || error.message;
      throw new BadRequestException(`payout req failed: ${providerMessage}`);
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    const body = payload.body as YooMoneyCallbackDto;
    const { operation_id, amount, sha1_hash, label } = body;

    const transaction = await this.transactionManager.getTransaction(
      Number(label),
      [
        'subMethod.method.providerSettings',
        'subMethod.method.providerSettings.provider',
        'user',
        'currency',
      ],
    );

    this.transactionManager.validateTransactionNotProcessed(transaction);

    if (transaction.amount !== parseFloat(amount)) {
      throw new BadRequestException('Amount mismatch');
    }

    const newGenerateSign = this.generateSignature(
      body,
      transaction.subMethod.method.providerSettings.privateKey as string,
    );

    if (newGenerateSign !== sha1_hash) {
      throw new BadRequestException('Hack attempt');
    }

    await this.transactionManager.completePayin(
      transaction.id as number,
      Number(amount),
      operation_id,
    );

    const providerName =
      transaction.subMethod?.method?.providerSettings?.provider?.name ||
      'YooMoney';

    await this.notificationService.notifyDepositSuccess({
      userTelegramId: transaction.user.telegramId,
      transactionId: transaction.id as number,
      amount: Number(amount),
      providerName,
    });
  }

  private generateSignature(
    body: YooMoneyCallbackDto,
    seckretKey: string,
  ): string {
    const {
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      label,
    } = body;
    const str = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${seckretKey}&${label || ''}`;

    return crypto.createHash('sha1').update(str, 'utf8').digest('hex');
  }
}
