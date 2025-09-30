import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmHealthIndicator } from './db.health';

@Module({
    imports: [TerminusModule, HttpModule, ConfigModule.forRoot()],
    controllers: [HealthController],
    providers: [MikroOrmHealthIndicator],
    exports: [MikroOrmHealthIndicator],
})
export class HealthModule { }


