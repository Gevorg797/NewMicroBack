import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
  Promocode,
  PromocodeUsage,
  User,
  Balances,
  PromocodeType,
  PromocodeStatus,
  PromocodeUsageStatus,
  BalanceType,
  FinanceTransactions,
  PaymentTransactionType,
  PaymentTransactionStatus,
  GameSession,
  GameTransaction,
  GameTransactionType,
  Bonuses,
  BonusStatus,
  BonusType,
} from '@lib/database';
import { CreatePromocodeDto } from './dto/create-promocode.dto';

@Injectable()
export class PromocodesService {
  constructor(
    @InjectRepository(Promocode)
    private readonly promocodeRepository: EntityRepository<Promocode>,
    @InjectRepository(PromocodeUsage)
    private readonly promocodeUsageRepository: EntityRepository<PromocodeUsage>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Balances)
    private readonly balancesRepository: EntityRepository<Balances>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Create a new promocode
   */
  async create(createPromocodeDto: CreatePromocodeDto): Promise<Promocode> {
    // Check if code already exists
    const existing = await this.promocodeRepository.findOne({
      code: createPromocodeDto.code,
    });

    if (existing) {
      throw new BadRequestException(
        `Promocode with code "${createPromocodeDto.code}" already exists`,
      );
    }

    // Verify the admin user exists
    const admin = await this.userRepository.findOne({
      id: createPromocodeDto.createdById,
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    const promocode = this.promocodeRepository.create({
      ...createPromocodeDto,
      createdBy: admin,
      status: createPromocodeDto.status || PromocodeStatus.ACTIVE,
      maxUses: createPromocodeDto.maxUses || 1,
      validFrom: createPromocodeDto.validFrom
        ? new Date(createPromocodeDto.validFrom)
        : null,
      validUntil: createPromocodeDto.validUntil
        ? new Date(createPromocodeDto.validUntil)
        : null,
    });

    await this.em.persistAndFlush(promocode);

    return promocode;
  }

  /**
   * Calculate total deposits for user in last 10 days
   */
  private async calculateTotalDepositsLast10Days(
    em: EntityManager,
    userId: number,
  ): Promise<number> {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    // Get all completed PAYIN transactions (deposits) for user in last 10 days
    const deposits = await em.find(FinanceTransactions, {
      user: userId,
      type: PaymentTransactionType.PAYIN,
      status: PaymentTransactionStatus.COMPLETED,
    });

    // Filter by date manually since createdAt might not be filterable directly
    const filteredDeposits = deposits.filter((deposit) => {
      const depositDate = deposit.createdAt || new Date(0);
      return depositDate >= tenDaysAgo;
    });

    let totalDeposits = 0;

    for (const deposit of filteredDeposits) {
      if (deposit.amount && deposit.amount > 0) {
        totalDeposits += Number(deposit.amount);
      }
    }

    return totalDeposits;
  }

  /**
   * Apply a promocode for a user (matching Python user_get_promo logic)
   */
  async applyPromocode(
    userId: number,
    code: string,
  ): Promise<
    | { error: string }
    | {
        successful: string;
        promocode: string;
        amount: number;
        bonus_id: number;
        bonusAmount: number;
        success: boolean;
      }
  > {
    return await this.em.transactional(async (em) => {
      try {
        // Calculate total deposits from last 10 days
        const totalDeposits = await this.calculateTotalDepositsLast10Days(
          em,
          userId,
        );

        // Find the promocode
        const promocode = await em.findOne(Promocode, {
          code: code,
        });

        if (!promocode) {
          return { error: '❌ Промокод не найден.' };
        }

        // Check if user already used this promocode
        const existingUsage = await em.findOne(PromocodeUsage, {
          user: userId,
          promocode: promocode.id,
        });

        if (existingUsage) {
          return { error: '❌ Вы уже активировали этот промокод.' };
        }

        // Count current usages
        const usageCount = await em.count(PromocodeUsage, {
          promocode: promocode.id,
        });

        // Check if max activations reached
        if (promocode.maxUses > 0 && usageCount >= promocode.maxUses) {
          return {
            error: '❌ К сожалению, количество активаций закончилось.',
          };
        }

        // Check expiration date
        const now = new Date();
        if (promocode.validUntil && new Date(promocode.validUntil) < now) {
          return { error: '❌ Срок действия промокода истёк.' };
        }

        // Validate deposit requirements using minDepositAmount
        const actualTotalDeposits = totalDeposits || 0;

        if (
          promocode.minDepositAmount !== undefined &&
          promocode.minDepositAmount > 0 &&
          actualTotalDeposits < promocode.minDepositAmount
        ) {
          const needed = promocode.minDepositAmount - actualTotalDeposits;
          return {
            error: `❌ Вам не хватает суммы депозитов для использования промокода.\n<blockquote>📍 Для активации требуется общая сумма депозитов не меньше <code>${promocode.minDepositAmount}RUB</> за последние 10 дней.\nСовершите пополнение еще на сумму ${needed}</>`,
          };
        }

        // Track usage via PromocodeUsage count (no need to update promocode directly)

        // Create PromocodeUsage record
        const usage = em.create(PromocodeUsage, {
          user: { id: userId } as User,
          promocode: promocode.id as any,
          usedAt: new Date(),
          status: PromocodeUsageStatus.APPLIED,
          bonusAmount: promocode.amount,
        });

        em.persist(usage);

        // Create Bonuses entity (not directly add to balance)
        const bonus = em.create(Bonuses, {
          user: { id: userId } as User,
          amount: promocode.amount.toString(),
          status: BonusStatus.CREATED,
          type: BonusType.PROMOCODE,
          wageringRequired: (promocode.amount * 2).toString(),
        });

        em.persist(bonus);
        await em.flush();

        return {
          successful: '✅ Промокод добавлен в ваши бонусы!',
          promocode: promocode.code,
          amount: promocode.amount,
          bonus_id: bonus.id as number,
          bonusAmount: promocode.amount,
          success: true,
        };
      } catch (error) {
        return {
          error: `❌ Ошибка при проверке промокода: ${error.message || error}`,
        };
      }
    });
  }

  /**
   * Get promocode by code
   */
  async findByCode(code: string): Promise<Promocode> {
    const promocode = await this.promocodeRepository.findOne(
      { code },
      {
        populate: ['createdBy'],
      },
    );

    if (!promocode) {
      throw new NotFoundException(`Promocode with code "${code}" not found`);
    }

    return promocode;
  }

  /**
   * Get promocode usage history for a user
   */
  async getUserPromocodeHistory(userId: number): Promise<PromocodeUsage[]> {
    return await this.promocodeUsageRepository.find(
      { user: userId },
      {
        populate: ['promocode', 'targetBalance'],
        orderBy: { usedAt: 'DESC' },
      },
    );
  }

  /**
   * Get all active promocodes
   */
  async getActivePromocodes(): Promise<Promocode[]> {
    return await this.promocodeRepository.find(
      { status: PromocodeStatus.ACTIVE },
      {
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  /**
   * Delete promocode by code
   */
  async deleteByCode(code: string): Promise<boolean> {
    try {
      const promocode = await this.promocodeRepository.findOne({ code });

      if (!promocode) {
        return false;
      }

      // First, delete all related PromocodeUsage records
      const usages = await this.promocodeUsageRepository.find({
        promocode: promocode.id,
      });

      if (usages.length > 0) {
        await this.em.removeAndFlush(usages);
      }

      // Now delete the promocode itself
      await this.em.removeAndFlush(promocode);
      return true;
    } catch (error) {
      console.error('Error deleting promocode:', error);
      return false;
    }
  }
}
