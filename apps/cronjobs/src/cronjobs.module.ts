import { DatabaseModule } from '@lib/database';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User, WheelTransaction } from '@lib/database';
import { WheelModule } from '../../api/src/wheel/wheel.module';
import { CronjobsController } from './cronjobs.controller';
import { CronjobsService } from './cronjobs.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    HttpModule,
    ConfigModule,
    HealthModule,
    WheelModule,
    MikroOrmModule.forFeature([User, WheelTransaction]),
  ],
  controllers: [CronjobsController],
  providers: [CronjobsService],
})
export class CronjobsModule {}
