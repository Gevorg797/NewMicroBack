import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class GetCurrenciesDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;
}
