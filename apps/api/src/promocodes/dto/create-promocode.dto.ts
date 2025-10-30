import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { PromocodeType, PromocodeStatus } from '@lib/database';

export class CreatePromocodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PromocodeType)
  type: PromocodeType;

  @IsNumber()
  @Min(0)
  amount: number; // Changed from value to amount

  @IsEnum(PromocodeStatus)
  @IsOptional()
  status?: PromocodeStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minDepositAmount?: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxUses?: number;

  @IsNumber()
  @IsNotEmpty()
  createdById: number; // The admin user ID
}
