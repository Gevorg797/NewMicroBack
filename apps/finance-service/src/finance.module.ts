import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from '@lib/database';

@Module({
  imports: [HealthModule, DatabaseModule,],
  controllers: [],
  providers: [],
  exports: [],
})
export class FinanceModule { }
