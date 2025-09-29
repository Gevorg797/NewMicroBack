import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIP, IsNumber, IsString, Min } from "class-validator";

export class CreatePayinOrderDto {
    @ApiProperty({ description: 'transaction Id' })
    @IsNumber()
    transactionId: number;

    @ApiProperty({ description: "Order amount" })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ description: 'Currency ID' })
    @IsNumber()
    currencyId: number;

    @ApiProperty({ description: 'Finance provider ID' })
    @IsNumber()
    providerSettingsId: number;
}