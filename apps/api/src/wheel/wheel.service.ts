import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { RecoilType } from './dto/wheel-spin.dto';
import {
  User,
  WheelConfig,
  WheelGivingType,
  GameSession,
  GameTransaction,
  GameTransactionType,
  GameTransactionStatus,
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

  constructor(
    @InjectRepository(WheelConfig)
    private readonly wheelConfigRepository: EntityRepository<WheelConfig>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(GameSession)
    private readonly gameSessionRepository: EntityRepository<GameSession>,
    @InjectRepository(GameTransaction)
    private readonly gameTransactionRepository: EntityRepository<GameTransaction>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Spin the wheel and return the result
   */
  spin(recoil: RecoilType): {
    amount: number;
    index: number;
    distribution: number[];
  } {
    const weights = this.distributions[recoil];
    const total = weights.reduce((sum, w) => sum + w, 0);
    const r = Math.random() * total;
    let acc = 0;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) {
        idx = i;
        break;
      }
    }
    return { amount: this.amounts[idx], index: idx, distribution: weights };
  }

  /**
   * Get wheel configuration (similar to get_wheel_config in Python)
   */
  async getWheelConfig(): Promise<WheelConfig> {
    // Get all configs (should only be one) and take the first
    const configs = await this.wheelConfigRepository.findAll();
    let config = configs.length > 0 ? configs[0] : null;

    if (!config) {
      // Create default config if it doesn't exist
      config = this.wheelConfigRepository.create({
        wheelLimit: '0',
        wheelEnoughSum: '0',
        wheelRecoil: WheelGivingType.NORMAL,
      });
      await this.em.persistAndFlush(config);
    }

    return config;
  }

  /**
   * Get the threshold sum needed to unlock wheel (similar to summ_to_enough in Python)
   */
  async sumToEnough(): Promise<number> {
    const config = await this.getWheelConfig();
    return parseFloat(config.wheelEnoughSum);
  }

  /**
   * Check if user has enough bets in last 30 days (similar to checkIsEnough in Python)
   */
  async checkIsEnough(userId: number): Promise<boolean> {
    try {
      const time30DaysAgo = new Date();
      time30DaysAgo.setDate(time30DaysAgo.getDate() - 30);

      // Get all game sessions for user within last 30 days
      const sessions = await this.gameSessionRepository.find(
        {
          user: { id: userId },
          startedAt: { $gte: time30DaysAgo },
        },
        {
          populate: ['transactions'],
        },
      );

      let totalBets = 0;

      // Calculate total bets from game transactions (DEPOSIT type means betting)
      for (const session of sessions) {
        // Load transactions if not already loaded
        if (!session.transactions.isInitialized()) {
          await session.transactions.loadItems();
        }

        for (const transaction of session.transactions) {
          if (
            transaction.type === GameTransactionType.DEPOSIT &&
            transaction.status === GameTransactionStatus.COMPLETED &&
            transaction.createdAt &&
            transaction.createdAt >= time30DaysAgo
          ) {
            totalBets += Number(transaction.amount);
          }
        }

        // Also check session diff (which might represent bet amount)
        // In case transactions aren't used for betting tracking
        if (
          session.diff &&
          session.diff > 0 &&
          session.startedAt >= time30DaysAgo
        ) {
          totalBets += session.diff;
        }
      }

      const enoughThreshold = await this.sumToEnough();
      return totalBets >= enoughThreshold;
    } catch (error) {
      console.error('Error checking if enough:', error);
      return false;
    }
  }

  /**
   * Check if user has special wheel unlock (similar to checkIsWheelUnlocked in Python)
   */
  async checkIsWheelUnlocked(userId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        return false;
      }

      if (!user.wheelUnlockExpiresAt) {
        return false;
      }

      // Check if the expiry date is still valid
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const expiryDate = new Date(user.wheelUnlockExpiresAt);
      expiryDate.setHours(0, 0, 0, 0);

      return expiryDate >= now;
    } catch (error) {
      console.error('Error checking wheel unlock:', error);
      return false;
    }
  }

  /**
   * Add special wheel access for user (similar to addWheel in Python)
   */
  async addWheel(userId: number, days: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        return false;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      // Set to start of day
      expiryDate.setHours(0, 0, 0, 0);

      user.wheelUnlockExpiresAt = expiryDate;
      await this.em.persistAndFlush(user);
      return true;
    } catch (error) {
      console.error('Error adding wheel:', error);
      return false;
    }
  }

  /**
   * Remove special wheel access for user (similar to removeWheel in Python)
   */
  async removeWheel(userId: number): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        return false;
      }

      user.wheelUnlockExpiresAt = undefined;
      await this.em.persistAndFlush(user);
      return true;
    } catch (error) {
      console.error('Error removing wheel:', error);
      return false;
    }
  }

  /**
   * Update wheel configuration (similar to change_WheelConfig in Python)
   */
  async changeWheelConfig(
    selectedChange: 'wheel_limit' | 'wheel_enough_sum',
    amount: string,
  ): Promise<boolean> {
    try {
      const config = await this.getWheelConfig();

      if (selectedChange === 'wheel_limit') {
        config.wheelLimit = amount;
      } else if (selectedChange === 'wheel_enough_sum') {
        config.wheelEnoughSum = amount;
      }

      await this.em.persistAndFlush(config);
      return true;
    } catch (error) {
      console.error('Error changing wheel config:', error);
      return false;
    }
  }

  /**
   * Update wheel giving type (similar to change_wheelGiving in Python)
   */
  async changeWheelGiving(newConfig: WheelGivingType): Promise<boolean> {
    try {
      const config = await this.getWheelConfig();
      config.wheelRecoil = newConfig;
      await this.em.persistAndFlush(config);
      return true;
    } catch (error) {
      console.error('Error changing wheel giving:', error);
      return false;
    }
  }

  /**
   * Convert WheelGivingType to RecoilType for spin method
   */
  getRecoilFromGiving(giving: WheelGivingType): RecoilType {
    const mapping: Record<WheelGivingType, RecoilType> = {
      [WheelGivingType.SUPER]: RecoilType.SUPER,
      [WheelGivingType.GOOD]: RecoilType.GOOD,
      [WheelGivingType.NORMAL]: RecoilType.NORMAL,
      [WheelGivingType.BAD]: RecoilType.BAD,
    };
    return mapping[giving] || RecoilType.NORMAL;
  }

  /**
   * Check if user can access wheel
   * Returns: { canAccess: boolean, reason: 'enough' | 'unlocked' | 'none' }
   */
  async canUserAccessWheel(userId: number): Promise<{
    canAccess: boolean;
    reason: 'enough' | 'unlocked' | 'none';
  }> {
    const isEnough = await this.checkIsEnough(userId);
    if (isEnough) {
      return { canAccess: true, reason: 'enough' };
    }

    const isUnlocked = await this.checkIsWheelUnlocked(userId);
    if (isUnlocked) {
      return { canAccess: true, reason: 'unlocked' };
    }

    return { canAccess: false, reason: 'none' };
  }

  /**
   * Spin wheel for user with proper recoil type from config
   */
  async spinForUser(userId: number): Promise<{
    amount: number;
    index: number;
    distribution: number[];
  }> {
    const config = await this.getWheelConfig();
    const recoilType = this.getRecoilFromGiving(config.wheelRecoil);
    return this.spin(recoilType);
  }
}
