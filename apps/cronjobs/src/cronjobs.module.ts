import { DatabaseModule } from '@lib/database';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CronjobsController } from './cronjobs.controller';
import { CronjobsService } from './cronjobs.service';


@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    HttpModule,
    ConfigModule,
  ],
  controllers: [CronjobsController],
  providers: [CronjobsService],
})
export class CronjobsModule { }
