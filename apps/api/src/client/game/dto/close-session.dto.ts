import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional } from 'class-validator';

export class CloseSessionDto {
  @ApiProperty({
    description: 'User ID',
    example: 123,
  })
  @IsNumber()
  userId: number;
}

