import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CheckBalanceParamsDto {
    @ApiProperty({ description: 'Partner alias', example: 12345 })
    @IsNumber()
    partnerAlias: number;

    @ApiProperty({ description: 'Partner session', example: 67890 })
    @IsNumber()
    partnerSession: number;

    @ApiProperty({ description: 'Currency code', example: 'USD' })
    @IsString()
    currency: string;
}

export class CheckBalanceDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({
        description: 'Check balance parameters',
        type: CheckBalanceParamsDto
    })
    @ValidateNested()
    @Type(() => CheckBalanceParamsDto)
    params: CheckBalanceParamsDto;
}
