import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HealthCheck, HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { MikroOrmHealthIndicator } from './db.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);
    private readonly baseUrl: string;

    constructor(
        private readonly healthCheckService: HealthCheckService,
        private readonly httpHealthIndicator: HttpHealthIndicator,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly dbHealthIndicator: MikroOrmHealthIndicator,
    ) {
        this.baseUrl = this.configService.get<string>('BASE_URL') || '';
    }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Check application health' })
    async check() {
        return this.healthCheckService.check([
            async () => this.dbHealthIndicator.pingCheck('database'),
            async () =>
                this.httpHealthIndicator
                    .pingCheck('api-self', `${this.baseUrl}api/health/health-check`)
                    .catch((err: any) => {
                        this.logger.error(` API Health Check Failed: ${err?.message}`);
                        return {
                            'api-self': {
                                status: 'down',
                                message: err?.message,
                                statusCode: err?.response?.status || 503,
                            },
                        } as any;
                    }),
        ]);
    }

    @Get('health-check')
    @ApiOperation({ summary: 'Check application health' })
    async checkHealth() {
        return { message: 'Health check successful' };
    }
}


