import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, IsEnum } from 'class-validator';
import { BalanceType } from '@lib/database';

export class InitGameSessionDto {
  @ApiProperty({
    description: 'User ID',
    example: 123,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'Site ID',
    example: 1,
  })
  @IsNumber()
  siteId: number;

  @ApiProperty({
    description: 'Game ID',
    example: 101,
  })
  @IsNumber()
  gameId: number;

  @ApiPropertyOptional({
    description: 'Balance type',
    enum: BalanceType,
    example: BalanceType.MAIN,
  })
  @IsOptional()
  @IsEnum(BalanceType)
  balanceType?: BalanceType;

  @ApiPropertyOptional({
    description: 'Additional parameters for the game session',
    example: {
      denomination: 1,
    },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

