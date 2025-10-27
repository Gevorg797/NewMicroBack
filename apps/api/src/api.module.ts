import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';
import { BikBetModule } from './bots/bik-bet/bikbet.module';
import { ClientModule } from './client/client.module';
import { HealthModule } from './health/health.module';
import { PromocodesModule } from './promocodes/promocodes.module';

@Module({
  providers: [],
  controllers: [],
  exports: [],
  imports: [DatabaseModule, HealthModule, BikBetModule, ClientModule, PromocodesModule],
})
export class ApiModule { }
