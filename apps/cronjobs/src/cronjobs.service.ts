import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { User, WheelTransaction, WheelTransactionStatus } from '@lib/database';
import { WheelService } from '../../api/src/wheel/wheel.service';

@Injectable()
export class CronjobsService {
  private readonly logger = new Logger(CronjobsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(WheelTransaction)
    private readonly wheelTransactionRepository: EntityRepository<WheelTransaction>,
    private readonly wheelService: WheelService,
    private readonly em: EntityManager,
  ) {}

  async handleDailyWheelTransactions() {
    this.logger.log('Starting daily wheel transactions cron job');
    const startTime = Date.now();

    try {
      const currentDate = this.getStartOfDay(new Date());

      // Get all users
      const users = await this.userRepository.findAll();

      let processedCount = 0;
      let expiredCount = 0;
      let createdCount = 0;
      let clearedExpiresAtCount = 0;

      for (const user of users) {
        try {
          // Step 1: Check if user has Колесо доступно (wheel access via enough deposits)
          const hasEnoughDeposits = await this.wheelService.checkIsEnough(
            user.id!,
          );

          if (hasEnoughDeposits) {
            // User has Колесо доступно - check for pending transaction
            const pendingTransaction =
              await this.wheelTransactionRepository.findOne({
                user: { id: user.id! },
                status: WheelTransactionStatus.PENDING,
              });

            if (pendingTransaction) {
              // Expire the pending transaction
              pendingTransaction.status = WheelTransactionStatus.EXPIRED;
              await this.em.persist(pendingTransaction);

              // Create a new pending transaction
              const spinResult = await this.wheelService.spinForUser(user.id!);
              const newTransaction = this.wheelTransactionRepository.create({
                user,
                amount: spinResult.amount.toString(),
                status: WheelTransactionStatus.PENDING,
              });
              await this.em.persist(newTransaction);

              expiredCount++;
              createdCount++;
              processedCount++;
              this.logger.debug(
                `User ${user.id} (${user.telegramId}): Has Колесо доступно, expired pending transaction and created new one`,
              );
            }
          }

          // Step 2: Check if user does NOT have Колесо доступно but has wheelUnlockExpiresAt
          if (!hasEnoughDeposits && user.wheelUnlockExpiresAt) {
            const expiresAtStart = this.getStartOfDay(
              new Date(user.wheelUnlockExpiresAt),
            );

            if (expiresAtStart >= currentDate) {
              // wheelUnlockExpiresAt is greater than or equal to current date
              const pendingTransaction =
                await this.wheelTransactionRepository.findOne({
                  user: { id: user.id! },
                  status: WheelTransactionStatus.PENDING,
                });

              if (pendingTransaction) {
                // Expire the pending transaction
                pendingTransaction.status = WheelTransactionStatus.EXPIRED;
                await this.em.persist(pendingTransaction);
              }

              // Create a new pending transaction
              const spinResult = await this.wheelService.spinForUser(user.id!);
              const newTransaction = this.wheelTransactionRepository.create({
                user,
                amount: spinResult.amount.toString(),
                status: WheelTransactionStatus.PENDING,
              });
              await this.em.persist(newTransaction);

              expiredCount++;
              createdCount++;
              processedCount++;
              this.logger.debug(
                `User ${user.id} (${user.telegramId}): Has valid wheelUnlockExpiresAt (no deposits), expired pending transaction and created new one`,
              );
            }
          }

          // Step 3: Check if wheelUnlockExpiresAt is less than current date
          if (user.wheelUnlockExpiresAt) {
            const expiresAtStart = this.getStartOfDay(
              new Date(user.wheelUnlockExpiresAt),
            );

            if (expiresAtStart < currentDate) {
              // wheelUnlockExpiresAt is less than current date - set to null
              user.wheelUnlockExpiresAt = undefined;
              await this.em.persist(user);
              clearedExpiresAtCount++;
              this.logger.debug(
                `User ${user.id} (${user.telegramId}): Cleared expired wheelUnlockExpiresAt`,
              );
            }
          }

          // Step 4: Check if wheelUnlockExpiresAt is less than current date
          if (!hasEnoughDeposits && !user.wheelUnlockExpiresAt) {
            // User has Колесо доступно - check for pending transaction
            const pendingTransaction =
              await this.wheelTransactionRepository.findOne({
                user: { id: user.id! },
                status: WheelTransactionStatus.PENDING,
              });

            if (pendingTransaction) {
              // Expire the pending transaction
              pendingTransaction.status = WheelTransactionStatus.EXPIRED;
              await this.em.persist(pendingTransaction);
            }
          }
        } catch (error) {
          this.logger.error(
            `Error processing user ${user.id} (${user.telegramId}): ${error.message}`,
            error.stack,
          );
        }
      }

      // Flush all changes
      await this.em.flush();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Daily wheel transactions cron job completed in ${duration}ms. ` +
          `Processed: ${processedCount}, Expired: ${expiredCount}, Created: ${createdCount}, ` +
          `Cleared wheelUnlockExpiresAt: ${clearedExpiresAtCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in daily wheel transactions cron job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get start of day (00:00:00.000)
   */
  private getStartOfDay(date: Date): Date {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  }
}
