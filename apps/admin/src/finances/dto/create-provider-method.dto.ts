import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum } from 'class-validator';
import {
  MethodNameEnum,
  MethodEnum,
} from '@lib/database/entities/finance-provider-methods.entity';

export class CreateProviderMethodDto {
  @ApiProperty({ description: 'Provider settings ID' })
  @IsNumber()
  providerSettingsId: number;

  @ApiProperty({ enum: MethodNameEnum, description: 'Method name' })
  @IsEnum(MethodNameEnum)
  name: MethodNameEnum;

  @ApiProperty({ enum: MethodEnum, description: 'Method value' })
  @IsEnum(MethodEnum)
  value: MethodEnum;
}
