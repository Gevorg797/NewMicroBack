import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateProviderDto {
  @ApiProperty({ description: 'Provider name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Is provider enabled', required: false })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
