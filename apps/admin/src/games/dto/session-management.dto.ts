import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SessionParamsDto {
    @ApiProperty({ description: 'Partner session ID', example: 'user_1_session_123' })
    @IsString()
    partnerSession: string;

    @ApiProperty({ description: 'Currency code', example: 'USD' })
    @IsString()
    currency: string;
}

export class SessionManagementDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({ description: 'Game ID', example: 288 })
    @IsNumber()
    gameId: number;

    @ApiProperty({
        description: 'Session management parameters',
        type: SessionParamsDto
    })
    @ValidateNested()
    @Type(() => SessionParamsDto)
    params: SessionParamsDto;
}
