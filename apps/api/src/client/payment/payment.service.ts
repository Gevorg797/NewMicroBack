import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePayinProcessDto } from './dto/create-payin-process.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Currency,
  FinanceProviderMethods,
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

@Injectable()
export class PaymentService {
  constructor(
    private readonly msFinanceService: MsFinanceService,
    @InjectRepository(FinanceProviderMethods)
    readonly fiananceProviderMethodsRepo: EntityRepository<FinanceProviderMethods>,
    @InjectRepository(FinanceProviderSettings)
    readonly financeProviderSettingsRepo: EntityRepository<FinanceProviderSettings>,
    @InjectRepository(FinanceTransactions)
    readonly financeTransactionsRepo: EntityRepository<FinanceTransactions>,
    @InjectRepository(User)
    readonly userRepo: EntityRepository<User>,
  ) {}

  async payin(body: CreatePayinProcessDto) {
    const { providerId, siteId, currencyId, methodId, amount, userId } = body;

    // const method = await this.fiananceProviderMethodsRepo.findOne({ id: methodId })

    // if (!method) {
    //     throw new Error('Method not found');
    // }

    // if (method.minAmount > amount) {
    //     throw new Error(`minAmount ${method.minAmount}`);
    // }

    // if (method.maxAmount < amount) {
    //     throw new Error(`maxAmount ${method.maxAmount}`);
    // }

    // const providerSettings = await this.financeProviderSettingsRepo.findOne({
    //     site: { id: siteId },
    //     provider: { id: providerId }
    // }, {
    //     populate: ['provider']
    // })

    // if (!providerSettings) {
    //     throw new Error('Provider not found');
    // }

    // if (!providerSettings.provider.isEnabled) {
    //     throw new Error('Provider is not available')
    // }

    // const transaction = this.financeTransactionsRepo.create({
    //     amount,
    //     type: PaymentTransactionType.PAYIN,
    //     method,
    //     user: this.financeTransactionsRepo.getEntityManager().getReference(User, userId),
    //     currency: this.financeTransactionsRepo.getEntityManager().getReference(Currency, currencyId),
    //     status: PaymentTransactionStatus.PENDING,
    //     userResponseStatus: PaymentTransactionUserResponseStatus.PENDING
    // });

    // await this.financeTransactionsRepo.getEntityManager().persistAndFlush(transaction);

    // const reqBody = {
    //     providerSettingsId: providerSettings.id as number,
    //     transactionId: transaction.id as number,
    //     amount,
    //     currencyId
    // }

    // let response: any;

    // try {
    //     switch (providerSettings.provider.name) {
    //         case 'Freekassa':
    //             response = this.msFinanceService.freekassaCreatePayin(reqBody)
    //             break;
    //         case 'Cryptobot':
    //             response = this.msFinanceService.cryptobotCreatePayin(reqBody)
    //             break;
    //         default:
    //             break;
    //     }

    //     return response
    // } catch (error) {
    //     transaction.status = PaymentTransactionStatus.FAILED;
    //     await this.financeTransactionsRepo.getEntityManager().persistAndFlush(transaction);

    //     throw new BadRequestException(error.message);
    // }
  }

  async payout(body: CreatePayoutProcessDto) {
    const { currencyId, methodId, amount, userId } = body;

    // const method = await this.fiananceProviderMethodsRepo.findOne(
    //   { id: methodId },
    //   {
    //     populate: ['providerSettings', 'providerSettings.provider'],
    //   },
    // );

    // if (!method) {
    //   throw new Error('Method not found');
    // }

    // if (method.minAmount > amount) {
    //   throw new Error(`minAmount ${method.minAmount}`);
    // }

    // if (method.maxAmount < amount) {
    //   throw new Error(`maxAmount ${method.maxAmount}`);
    // }

    // if (!method.providerSettings) {
    //   throw new Error('Provider not found');
    // }

    // if (!method.providerSettings.provider.isEnabled) {
    //   throw new Error('Provider is not available');
    // }

    // const user = await this.userRepo.findOne(
    //   { id: userId },
    //   {
    //     populate: ['balance'],
    //   },
    // );

    // if (user && (user.balance?.balance as number) - amount < 0) {
    //   throw new Error('Not enough balance');
    // }

    // const transaction = this.financeTransactionsRepo.create({
    //   amount,
    //   type: PaymentTransactionType.PAYOUT,
    //   method,
    //   user: this.financeTransactionsRepo
    //     .getEntityManager()
    //     .getReference(User, userId),
    //   currency: this.financeTransactionsRepo
    //     .getEntityManager()
    //     .getReference(Currency, currencyId),
    //   status: PaymentTransactionStatus.PENDING,
    //   userResponseStatus: PaymentTransactionUserResponseStatus.PENDING,
    // });

    // await this.financeTransactionsRepo
    //   .getEntityManager()
    //   .persistAndFlush(transaction);

    // const reqBody = {
    //   transactionId: transaction.id as number,
    //   amount,
    //   currencyId,
    // };

    // let response: any;

    // try {
    //   switch (method.providerSettings.provider.name) {
    //     case 'Cryptobot':
    //       response = await this.msFinanceService.cryptobotCreatePayout(reqBody);
    //       break;
    //     default:
    //       break;
    //   }

    //   return response;
    // } catch (error) {
    //   transaction.status = PaymentTransactionStatus.FAILED;
    //   await this.financeTransactionsRepo
    //     .getEntityManager()
    //     .persistAndFlush(transaction);

    //   throw new BadRequestException(error.message);
    // }
  }
}
