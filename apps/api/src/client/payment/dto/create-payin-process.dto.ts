import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreatePayinProcessDto {
  @ApiProperty({ description: 'User ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Amount to deposit', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Payment method ID' })
  @IsNumber()
  methodId: number;

  @ApiProperty({ description: 'Optional UUID', required: false })
  @IsString()
  @IsOptional()
  uuId?: string;
}
