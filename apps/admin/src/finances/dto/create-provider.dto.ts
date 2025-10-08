import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateProviderDto {
  @ApiProperty({ description: 'Provider name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Is provider enabled',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
