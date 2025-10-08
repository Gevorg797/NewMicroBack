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

    @ApiProperty({
        description: 'Site ID (optional - determined from user session)',
        example: 1,
        required: false
    })
    @IsNumber()
    @IsOptional()
    siteId?: number;

    @ApiProperty({
        description: 'Game ID (optional - determined from user active session)',
        example: 288,
        required: false
    })
    @IsNumber()
    @IsOptional()
    gameId?: number;

    @ApiProperty({
        description: 'Session management parameters (optional)',
        type: SessionParamsDto,
        required: false
    })
    @ValidateNested()
    @Type(() => SessionParamsDto)
    @IsOptional()
    params?: SessionParamsDto;
}
