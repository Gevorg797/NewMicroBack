import { IsString, IsNumberString, IsOptional } from 'class-validator';

export class YooMoneyCallbackDto {
    @IsString()
    operation_id: string;

    @IsString()
    notification_type: string;

    @IsString()
    datetime: string;

    @IsString()
    sha1_hash: string;

    @IsString()
    sender: string;

    @IsString()
    codepro: string;

    @IsNumberString()
    currency: string;

    @IsString()
    amount: string;

    @IsOptional()
    @IsString()
    withdraw_amount?: string;

    @IsOptional()
    @IsString()
    label?: string;
}