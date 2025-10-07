import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';

export enum PaymentType {
  PAYIN = 'payin',
  PAYOUT = 'payout',
}

export class CreatePayinDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  amount: number;

  @IsNumber()
  methodId: number;

  @IsString()
  @IsOptional()
  uuId?: string;
}

export class CreatePayoutDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  amount: number;

  @IsNumber()
  methodId: number;

  @IsString()
  @IsOptional()
  requisite?: string;
}

export class PaymentResponseDto {
  success: boolean;
  data?: any;
  error?: string;
}
