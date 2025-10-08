import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateProviderSettingsDto {
  @ApiProperty({ description: 'Provider ID' })
  @IsNumber()
  providerId: number;

  @ApiProperty({ description: 'Site ID' })
  @IsNumber()
  siteId: number;

  @ApiProperty({ description: 'Shop ID', required: false })
  @IsString()
  @IsOptional()
  shopId?: string;

  @ApiProperty({ description: 'Public Key', required: false })
  @IsString()
  @IsOptional()
  publicKey?: string;

  @ApiProperty({ description: 'Private Key', required: false })
  @IsString()
  @IsOptional()
  privateKey?: string;

  @ApiProperty({ description: 'API Key', required: false })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiProperty({ description: 'Base URL', required: false })
  @IsString()
  @IsOptional()
  baseURL?: string;

  @ApiProperty({ description: 'Payment Form Link', required: false })
  @IsString()
  @IsOptional()
  paymentFormLink?: string;

  @ApiProperty({ description: 'Callback URL', required: false })
  @IsString()
  @IsOptional()
  callbackUrl?: string;

  @ApiProperty({ description: 'Percentage fee', required: false })
  @IsNumber()
  @IsOptional()
  percentage?: number;
}
