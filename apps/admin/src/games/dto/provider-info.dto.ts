import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProviderInfoParamsDto {
    @ApiProperty({ description: 'Partner alias', example: 12345, required: false })
    @IsOptional()
    @IsNumber()
    partnerAlias?: number;

    @ApiProperty({ description: 'Partner session', example: 67890, required: false })
    @IsOptional()
    @IsNumber()
    partnerSession?: number;
}

export class ProviderInfoDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({
        description: 'Provider info parameters (optional)',
        type: ProviderInfoParamsDto,
        required: false
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ProviderInfoParamsDto)
    params?: ProviderInfoParamsDto;
}
