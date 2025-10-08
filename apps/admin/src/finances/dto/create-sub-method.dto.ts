import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { MethodTypeEnum } from '@lib/database/entities/finance-provider-sub-method.entity';

export class CreateSubMethodDto {
  @ApiProperty({ description: 'Provider method ID' })
  @IsNumber()
  methodId: number;

  @ApiProperty({ description: 'Site ID' })
  @IsNumber()
  siteId: number;

  @ApiProperty({ enum: MethodTypeEnum, description: 'Type (Payin/Payout)' })
  @IsEnum(MethodTypeEnum)
  type: MethodTypeEnum;

  @ApiProperty({ description: 'Minimum amount', required: false })
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiProperty({ description: 'Maximum amount', required: false })
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiProperty({ description: 'Is enabled', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
