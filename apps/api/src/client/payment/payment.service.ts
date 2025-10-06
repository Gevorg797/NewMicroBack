import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { CreatePayinProcessDto } from './dto/create-payin-process.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderSettings,
  FinanceTransactions,
  User,
} from '@lib/database';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentTransactionUserResponseStatus,
} from '@lib/database/entities/finance-provider-transactions.entity';
import { MsFinanceService } from 'libs/microservices-clients/ms-finance/ms-finance.service';
import { CreatePayoutProcessDto } from './dto/create-payout-process.dto';
import { FinanceProviderSubMethods } from '@lib/database/entities/finance-provider-sub-method.entity';

@Injectable()
export class PaymentService {
  constructor(
    private readonly msFinanceService: MsFinanceService,
    @InjectRepository(FinanceProviderSubMethods)
    readonly fiananceProviderSubMethodsRepo: EntityRepository<FinanceProviderSubMethods>,
    @InjectRepository(FinanceProviderSettings)
    readonly financeProviderSettingsRepo: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionsRepo: EntityRepository<FinanceTransactions>,
    @InjectRepository(User)
    readonly userRepo: EntityRepository<User>,
  ) { }

  async payin(body: CreatePayinProcessDto) {
    const { methodId, amount, userId } = body;

    const subMethod = await this.fiananceProviderSubMethodsRepo.findOne(
      { id: methodId },
      { populate: ['method.providerSettings', 'method.providerSettings.provider'] }
    );

    const user = await this.userRepo.findOne({ id: userId }, {
      populate: ['balance.currency']
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (!subMethod) {
      throw new Error('Method not found');
    }

    if (subMethod.minAmount > amount) {
      throw new Error(`minAmount ${subMethod.minAmount}`);
    }

    if (subMethod.maxAmount < amount) {
      throw new Error(`maxAmount ${subMethod.maxAmount}`);
    }

    if (!subMethod.method.providerSettings) {
      throw new Error('Provider not found');
    }

    if (!subMethod.isEnabled) {
      throw new Error('method is not available')
    }

    const transaction = this.financeTransactionsRepo.create({
      amount,
      type: PaymentTransactionType.PAYIN,
      subMethod,
      user: this.financeTransactionsRepo
        .getEntityManager()
        .getReference(User, userId),
      currency: this.financeTransactionsRepo
        .getEntityManager()
        .getReference(Currency, user.balance?.currency.id as number),
      status: PaymentTransactionStatus.PENDING,
      userResponseStatus: PaymentTransactionUserResponseStatus.PENDING
    });

    await this.financeTransactionsRepo.getEntityManager().persistAndFlush(transaction);

    const reqBody = {
      transactionId: transaction.id as number,
      amount,
    }

    let response: any;

    try {
      switch (subMethod.method.providerSettings.provider.name) {
        case 'Freekassa':
          response = await this.msFinanceService.freekassaCreatePayin(reqBody)
          break;
        case 'Cryptobot':
          response = await this.msFinanceService.cryptobotCreatePayin(reqBody)
          break;
        case 'Yoomoney':
          response = await this.msFinanceService.yoomoneyCreatePayin(reqBody)
        default:
          break;
      }

      return response
    } catch (error) {
      transaction.status = PaymentTransactionStatus.FAILED;
      await this.financeTransactionsRepo.getEntityManager().persistAndFlush(transaction);

      throw new BadRequestException(error.message);
    }
  }

  async payout(body: CreatePayoutProcessDto) {
    const { methodId, amount, userId, requisite } = body;

    const subMethod = await this.fiananceProviderSubMethodsRepo.findOne(
      { id: methodId },
      { populate: ['method.providerSettings', 'method.providerSettings.provider'] }
    );

    if (!subMethod) {
      throw new Error('Method not found');
    }

    if (subMethod.minAmount > amount) {
      throw new Error(`minAmount ${subMethod.minAmount}`);
    }

    if (subMethod.maxAmount < amount) {
      throw new Error(`maxAmount ${subMethod.maxAmount}`);
    }

    if (!subMethod.isEnabled) {
      throw new Error('Method is not available');
    }

    const user = await this.userRepo.findOne(
      { id: userId },
      {
        populate: ['balance', 'balance.currency'],
      },
    );

    if (!user) {
      throw new Error('User not found')
    }

    if ((user.balance?.balance as number) - amount < 0) {
      throw new Error('Not enough balance');
    }

    const transaction = this.financeTransactionsRepo.create({
      amount,
      type: PaymentTransactionType.PAYOUT,
      subMethod,
      user: this.financeTransactionsRepo
        .getEntityManager()
        .getReference(User, userId),
      currency: this.financeTransactionsRepo
        .getEntityManager()
        .getReference(Currency, user.balance?.currency.id as number),
      status: PaymentTransactionStatus.PENDING,
      userResponseStatus: PaymentTransactionUserResponseStatus.PENDING,
    });

    await this.financeTransactionsRepo
      .getEntityManager()
      .persistAndFlush(transaction);

    const reqBody = {
      transactionId: transaction.id as number,
      amount,
    };

    let response: any;

    try {
      switch (subMethod.method.providerSettings.provider.name) {
        case 'Cryptobot':
          response = await this.msFinanceService.cryptobotCreatePayout(reqBody);
          break;
        case 'Yoomoney':
          Object.assign(reqBody, {
            to: requisite
          });

          response = await this.msFinanceService.yoomoneyCreatePayout(reqBody)
          break;
        default:
          break;
      }

      return response;
    } catch (error) {
      transaction.status = PaymentTransactionStatus.FAILED;
      await this.financeTransactionsRepo
        .getEntityManager()
        .persistAndFlush(transaction);

      throw new BadRequestException(error.message);
    }
  }
}
