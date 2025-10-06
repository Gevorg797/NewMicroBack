import { IsNumber, Min } from "class-validator";

export class CreatePayinProcessDto {
    @IsNumber()
    @Min(0)
    amount: number

    @IsNumber()
    methodId: number

    @IsNumber()
    userId: number
}