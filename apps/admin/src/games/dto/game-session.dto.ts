import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GameSessionParamsDto {
    @ApiProperty({ description: 'Game ID', example: 288 })
    @IsNumber()
    gameId: number;

    // @ApiProperty({ description: 'Currency code', example: 'RUB' })
    // @IsString()
    // currency: string;

    // For demo session
    @ApiProperty({ description: 'Demo balance', example: 1000.00, required: false })
    @IsOptional()
    @IsNumber()
    balance?: number;

    @ApiProperty({ description: 'Denomination', example: 0.01, required: false })
    @IsOptional()
    @IsNumber()
    denomination?: number;

    // For real session

    @ApiProperty({ description: 'Partner session', example: "67890", required: false })
    @IsOptional()
    partnerSession?: number | string;

    @ApiProperty({ description: 'Freerounds ID', example: "98765", required: false })
    @IsOptional()
    freeroundsId?: number | string;

    // Optional parameters
    @ApiProperty({ description: 'Language code', example: 'en', required: false })
    @IsOptional()
    @IsString()
    lang?: string;

    @ApiProperty({ description: 'Device type', example: 'desktop', required: false })
    @IsOptional()
    @IsString()
    device?: string;

    @ApiProperty({ description: 'IP address', example: '203.0.113.10', required: false })
    @IsOptional()
    @IsString()
    ip?: string;

    @ApiProperty({ description: 'Country code', example: 'US', required: false })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({ description: 'Return URL', example: 'https://admin.example.com/games/return', required: false })
    @IsOptional()
    @IsString()
    returnUrl?: string;
}

export class GameSessionDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({
        description: 'Game session parameters',
        type: GameSessionParamsDto
    })
    @ValidateNested()
    @Type(() => GameSessionParamsDto)
    params: GameSessionParamsDto;
}
