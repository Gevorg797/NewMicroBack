import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsObject } from 'class-validator';

export class LoadGamesDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({ description: 'Additional parameters', required: false, example: { category: 'slots' } })
    @IsOptional()
    @IsObject()
    params?: any;
}
