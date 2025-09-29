import { IsNumber, Min } from "class-validator";

export class CreatePayoutProcessDto {
    @IsNumber()
    @Min(0)
    amount: number

    @IsNumber()
    methodId: number

    @IsNumber()
    currencyId: number

    @IsNumber()
    userId: number
}