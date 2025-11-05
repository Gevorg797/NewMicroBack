import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { RecoilType } from './dto/wheel-spin.dto';
import {
  User,
  WheelConfig,
  WheelGivingType,
  WheelTransaction,
  WheelTransactionStatus,
  FinanceTransactions,
  PaymentTransactionType,
  PaymentTransactionStatus,
} from '@lib/database';

@Injectable()
export class WheelService {
  private readonly amounts: number[] = [
    1000, 500, 200, 150, 100, 75, 50, 35, 25, 10,
  ];

  private readonly distributions: Record<RecoilType, number[]> = {
    [RecoilType.BAD]: [3, 5, 5, 7, 7, 10, 10, 15, 18, 20],
    [RecoilType.NORMAL]: [3, 3, 5, 18, 26, 18, 10, 7, 5, 5],
    [RecoilType.GOOD]: [12, 13, 20, 24, 14, 5, 3, 3, 3, 3],
    [RecoilType.SUPER]: [17, 24, 20, 12, 10, 5, 3, 3, 3, 3],
  };

  private readonly DEPOSIT_CHECK_DAYS = 30;
  private readonly DEFAULT_WHEEL_LIMIT = '0';
  private readonly DEFAULT_WHEEL_ENOUGH_SUM = '0';

  constructor(
    @InjectRepository(WheelConfig)
    private readonly wheelConfigRepository: EntityRepository<WheelConfig>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(WheelTransaction)
    private readonly wheelTransactionRepository: EntityRepository<WheelTransaction>,
    @InjectRepository(FinanceTransactions)
    private readonly financeTransactionsRepository: EntityRepository<FinanceTransactions>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Spin the wheel and return the result based on weighted distribution
   */
  spin(recoil: RecoilType): {
    amount: number;
    index: number;
    distribution: number[];
  } {
    const weights = this.distributions[recoil];
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const randomValue = Math.random() * totalWeight;

    let accumulatedWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      accumulatedWeight += weights[i];
      if (randomValue < accumulatedWeight) {
        return {
          amount: this.amounts[i],
          index: i,
          distribution: weights,
        };
      }
    }

    // Fallback to first item (should rarely happen)
    return {
      amount: this.amounts[0],
      index: 0,
      distribution: weights,
    };
  }

  /**
   * Get wheel configuration, creating default if not exists
   */
  async getWheelConfig(): Promise<WheelConfig> {
    const configs = await this.wheelConfigRepository.findAll();

    if (configs.length > 0) {
      return configs[0];
    }

    // Create default config if it doesn't exist
    const defaultConfig = this.wheelConfigRepository.create({
      wheelLimit: this.DEFAULT_WHEEL_LIMIT,
      wheelEnoughSum: this.DEFAULT_WHEEL_ENOUGH_SUM,
      wheelRecoil: WheelGivingType.NORMAL,
    });

    await this.em.persistAndFlush(defaultConfig);
    return defaultConfig;
  }

  /**
   * Get the threshold sum needed to unlock wheel
   */
  async sumToEnough(): Promise<number> {
    const config = await this.getWheelConfig();
    return parseFloat(config.wheelEnoughSum) || 0;
  }

  /**
   * Check if user has enough deposits in the configured period
   */
  async checkIsEnough(userId: number): Promise<boolean> {
    try {
      const cutoffDate = this.getDateDaysAgo(this.DEPOSIT_CHECK_DAYS);
      const totalDeposits = await this.calculateUserDeposits(
        userId,
        cutoffDate,
      );
      const threshold = await this.sumToEnough();

      return totalDeposits >= threshold;
    } catch (error) {
      console.error('Error checking if user has enough deposits:', error);
      return false;
    }
  }

  /**
   * Calculate total completed deposits for user since cutoff date
   */
  private async calculateUserDeposits(
    userId: number,
    cutoffDate: Date,
  ): Promise<number> {
    const transactions = await this.financeTransactionsRepository.find({
      user: { id: userId },
      type: PaymentTransactionType.PAYIN,
      status: PaymentTransactionStatus.COMPLETED,
      createdAt: { $gte: cutoffDate },
    });

    return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }

  /**
   * Get date N days ago
   */
  private getDateDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  /**
   * Check if user has special wheel unlock that hasn't expired
   */
  async checkIsWheelUnlocked(userId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });

      if (!user?.wheelUnlockExpiresAt) {
        return false;
      }

      return this.isDateStillValid(user.wheelUnlockExpiresAt);
    } catch (error) {
      console.error('Error checking wheel unlock status:', error);
      return false;
    }
  }

  /**
   * Check if expiry date is still valid (not expired)
   */
  private isDateStillValid(expiryDate: Date): boolean {
    const now = this.getStartOfDay(new Date());
    const expiry = this.getStartOfDay(new Date(expiryDate));
    return expiry >= now;
  }

  /**
   * Get start of day (00:00:00.000)
   */
  private getStartOfDay(date: Date): Date {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  }

  /**
   * Add special wheel access for user with auto-spin
   */
  async addWheel(userId: number, days: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        return false;
      }

      const expiryDate = this.calculateExpiryDate(days);
      const spinResult = await this.spinForUser(userId);

      // Update user's wheel unlock expiry date
      user.wheelUnlockExpiresAt = expiryDate;

      const wheelTransaction = this.wheelTransactionRepository.create({
        user,
        amount: spinResult.amount.toString(),
        status: WheelTransactionStatus.PENDING,
      });

      await this.em.persistAndFlush([user, wheelTransaction]);
      return true;
    } catch (error) {
      console.error('Error adding wheel access:', error);
      return false;
    }
  }

  /**
   * Calculate expiry date from current date + days
   */
  private calculateExpiryDate(days: number): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return this.getStartOfDay(expiryDate);
  }

  /**
   * Remove special wheel access for user
   */
  async removeWheel(userId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });

      if (!user) {
        return false;
      }

      // Remove wheel unlock expiry from user
      user.wheelUnlockExpiresAt = undefined;

      await this.em.persistAndFlush(user);
      return true;
    } catch (error) {
      console.error('Error removing wheel access:', error);
      return false;
    }
  }

  /**
   * Update wheel configuration (limit or threshold)
   */
  async changeWheelConfig(
    selectedChange: 'wheel_limit' | 'wheel_enough_sum',
    amount: string,
  ): Promise<boolean> {
    try {
      const config = await this.getWheelConfig();

      if (selectedChange === 'wheel_limit') {
        config.wheelLimit = amount;
      } else {
        config.wheelEnoughSum = amount;
      }

      await this.em.persistAndFlush(config);
      return true;
    } catch (error) {
      console.error('Error updating wheel config:', error);
      return false;
    }
  }

  /**
   * Update wheel giving type (recoil configuration)
   */
  async changeWheelGiving(givingType: WheelGivingType): Promise<boolean> {
    try {
      const config = await this.getWheelConfig();
      config.wheelRecoil = givingType;
      await this.em.persistAndFlush(config);
      return true;
    } catch (error) {
      console.error('Error updating wheel giving type:', error);
      return false;
    }
  }

  /**
   * Check if user can access wheel and return the reason
   */
  async canUserAccessWheel(userId: number): Promise<{
    canAccess: boolean;
    reason: 'enough' | 'unlocked' | 'none';
  }> {
    if (await this.checkIsEnough(userId)) {
      return { canAccess: true, reason: 'enough' };
    }

    if (await this.checkIsWheelUnlocked(userId)) {
      return { canAccess: true, reason: 'unlocked' };
    }

    return { canAccess: false, reason: 'none' };
  }

  /**
   * Spin wheel for user using configured recoil type
   */
  async spinForUser(userId: number): Promise<{
    amount: number;
    index: number;
    distribution: number[];
  }> {
    const config = await this.getWheelConfig();
    const recoilType = this.mapGivingToRecoil(config.wheelRecoil);
    return this.spin(recoilType);
  }

  /**
   * Map WheelGivingType to RecoilType
   */
  private mapGivingToRecoil(giving: WheelGivingType): RecoilType {
    const mapping: Record<WheelGivingType, RecoilType> = {
      [WheelGivingType.SUPER]: RecoilType.SUPER,
      [WheelGivingType.GOOD]: RecoilType.GOOD,
      [WheelGivingType.NORMAL]: RecoilType.NORMAL,
      [WheelGivingType.BAD]: RecoilType.BAD,
    };
    return mapping[giving] ?? RecoilType.NORMAL;
  }
}
