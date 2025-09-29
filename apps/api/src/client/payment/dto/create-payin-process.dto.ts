import { IsNumber, Min } from "class-validator";

export class CreatePayinProcessDto {
    @IsNumber()
    @Min(0)
    amount: number

    @IsNumber()
    providerId: number

    @IsNumber()
    siteId: number

    @IsNumber()
    methodId: number

    @IsNumber()
    currencyId: number

    @IsNumber()
    userId: number
}