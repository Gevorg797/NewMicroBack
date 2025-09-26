import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GameHistoryParamsDto {
    @ApiProperty({ description: 'Partner alias', example: 12345 })
    @IsNumber()
    partnerAlias: number;

    @ApiProperty({ description: 'Partner session', example: 67890 })
    @IsNumber()
    partnerSession: number;

    @ApiProperty({ description: 'Game ID', example: 15 })
    @IsNumber()
    gameId: number;

    @ApiProperty({ description: 'Currency code', example: 'USD' })
    @IsString()
    currency: string;

    @ApiProperty({ description: 'From date (YYYY-MM-DD)', example: '2024-01-01', required: false })
    @IsOptional()
    @IsString()
    from?: string;

    @ApiProperty({ description: 'To date (YYYY-MM-DD)', example: '2024-12-31', required: false })
    @IsOptional()
    @IsString()
    to?: string;
}

export class GameHistoryDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({
        description: 'Game history parameters',
        type: GameHistoryParamsDto
    })
    @ValidateNested()
    @Type(() => GameHistoryParamsDto)
    params: GameHistoryParamsDto;
}
