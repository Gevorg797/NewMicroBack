import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { MethodTypeEnum } from '@lib/database/entities/finance-provider-sub-method.entity';

export class UpdateSubMethodDto {
  @ApiProperty({
    enum: MethodTypeEnum,
    description: 'Type (Payin/Payout)',
    required: false,
  })
  @IsEnum(MethodTypeEnum)
  @IsOptional()
  type?: MethodTypeEnum;

  @ApiProperty({ description: 'Minimum amount', required: false })
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiProperty({ description: 'Maximum amount', required: false })
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiProperty({ description: 'Is enabled', required: false })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
