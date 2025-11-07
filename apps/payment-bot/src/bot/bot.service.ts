import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
    User,
    Currency,
    Balances,
    CurrencyType,
    Site,
    BalanceType,
    PaymentPayoutRequisite,
    BalancesHistory,
    FinanceTransactions,
    PaymentTransactionStatus,
    PaymentTransactionType,
} from '@lib/database';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BotService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: EntityRepository<User>,
        @InjectRepository(Currency)
        private readonly currencyRepository: EntityRepository<Currency>,
        @InjectRepository(Balances)
        private readonly balancesRepository: EntityRepository<Balances>,
        @InjectRepository(Site)
        private readonly siteRepository: EntityRepository<Site>,
        @InjectRepository(PaymentPayoutRequisite)
        private readonly paymentRequisiteRepository: EntityRepository<PaymentPayoutRequisite>,
        @InjectRepository(BalancesHistory)
        private readonly balancesHistoryRepository: EntityRepository<BalancesHistory>,
        @InjectRepository(FinanceTransactions)
        private readonly financeTransactionsRepository: EntityRepository<FinanceTransactions>,
        private readonly em: EntityManager,
    ) { }

    async onModuleInit() {
        this.logger.log('Payment Bot Service initialized');
    }

    async onModuleDestroy() {
        this.logger.log('Payment Bot Service destroyed');
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        const memoryUsage = process.memoryUsage();
        return {
            rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        };
    }
}

