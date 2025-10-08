import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePayoutProcessDto {
  @ApiProperty({ description: 'User ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Amount to withdraw', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Payment method ID' })
  @IsNumber()
  methodId: number;

  @ApiProperty({
    description: 'Requisite (wallet address, card number, etc.)',
    required: false,
  })
  @IsOptional()
  @IsString()
  requisite?: string;
}
