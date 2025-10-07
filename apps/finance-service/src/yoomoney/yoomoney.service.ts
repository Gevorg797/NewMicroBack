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
  Balances,
  BalanceType,
} from '@lib/database';
import { EntityRepository } from '@mikro-orm/postgresql';
import { PaymentTransactionStatus } from '@lib/database/entities/finance-provider-transactions.entity';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class YoomoneyServcie {
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

  async createPayinOrder(body: any) {
    const { transactionId, amount } = body;

    const transaction = await this.financeTransactionRepo.findOne(
      { id: transactionId },
      {
        populate: ['subMethod.method.providerSettings', 'subMethod.method'],
      },
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const providerSettings = transaction?.subMethod.method.providerSettings;
    const url = transaction?.subMethod.method.providerSettings.paymentFormLink;

    const paymentUrl = `${url}?receiver=${providerSettings.shopId}&quickpay-form=button&paymentType=${transaction.subMethod.method.value}&sum=${amount}&label=${transaction.id}`;

    return { paymentUrl };
  }

  async createPayoutProcess(body: any) {
    const { transactionId, amount, to } = body;

    const transaction = await this.financeTransactionRepo.findOne(
      { id: transactionId },
      { populate: ['subMethod.method.providerSettings'] },
    );

    if (!transaction) throw new NotFoundException('Transaction not found');

    const providerSettings = transaction.subMethod.method.providerSettings;
    const accessToken = providerSettings.publicKey as string;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const reqParams = new URLSearchParams({
      pattern_id: 'p2p',
      to: to,
      amount_due: amount.toString(),
      comment: `Withdrawal tx:${transaction.id}`,
      label: transactionId,
    });

    try {
      const { data: requestData } = await axios.post(
        `${providerSettings.baseURL}request-payment`,
        reqParams,
        {
          headers,
        },
      );

      if (requestData.status !== 'success') {
        transaction.status = PaymentTransactionStatus.FAILED;
        await this.financeTransactionRepo
          .getEntityManager()
          .persistAndFlush(transaction);
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
        transaction.status = PaymentTransactionStatus.COMPLETED;
        transaction.paymentTransactionId = processData.payment_id;
      } else {
        throw new BadRequestException(
          `process-payment failed: ${processData.error}`,
        );
      }

      await this.financeTransactionRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      return processData;
    } catch (error) {
      transaction.status = PaymentTransactionStatus.FAILED;
      await this.financeTransactionRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      const providerMessage = error.response?.data?.error.name || error.message;
      throw new BadRequestException(`payout req failed: ${providerMessage}`);
    }
  }

  async handleCallback(body: YooMoneyCallbackDto) {
    const { operation_id, amount, sha1_hash, label } = body;

    const transaction = await this.financeTransactionRepo.findOne(
      { id: Number(label) },
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
      throw new BadRequestException(
        'Transaction already processed, return early',
      );
    }

    if (transaction.amount !== parseFloat(amount)) {
      throw new BadRequestException('Amount mismatch');
    }

    const newGenerateSign = this.generateSignature(
      body,
      transaction.subMethod.method.providerSettings.privateKey as string,
    );
    // const newGenerateSign = this.generateSignature(body, 'g8e45AweR+w3J7Osf6NhlkPu')

    if (newGenerateSign !== sha1_hash) {
      throw new BadRequestException('Hack attempt');
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
    transaction.paymentTransactionId = operation_id;
    mainBalance.balance += Number(amount);

    await this.financeTransactionRepo
      .getEntityManager()
      .persistAndFlush([transaction, mainBalance]);
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
