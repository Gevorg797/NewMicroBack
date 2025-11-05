import { Controller, Logger } from '@nestjs/common';
import { CronjobsService } from './cronjobs.service';
import { Cron } from '@nestjs/schedule';

@Controller()
export class CronjobsController {
  private readonly logger = new Logger(CronjobsController.name);

  constructor(private readonly cronjobsService: CronjobsService) {}

  /**
   * Cron job that runs every day at 00:01 Moscow time
   * Handles wheel transactions for users with wheel access
   */
  @Cron('1 0 * * *', {
    timeZone: 'Europe/Moscow',
  })
  async handleDailyWheelTransactions(): Promise<void> {
    this.logger.log('Triggering daily wheel transactions cron job');
    await this.cronjobsService.handleDailyWheelTransactions();
  }
}
