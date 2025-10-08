import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  MethodNameEnum,
  MethodEnum,
} from '@lib/database/entities/finance-provider-methods.entity';

export class UpdateProviderMethodDto {
  @ApiProperty({
    enum: MethodNameEnum,
    description: 'Method name',
    required: false,
  })
  @IsEnum(MethodNameEnum)
  @IsOptional()
  name?: MethodNameEnum;

  @ApiProperty({
    enum: MethodEnum,
    description: 'Method value',
    required: false,
  })
  @IsEnum(MethodEnum)
  @IsOptional()
  value?: MethodEnum;
}
