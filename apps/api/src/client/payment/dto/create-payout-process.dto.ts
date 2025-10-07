import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreatePayoutProcessDto {
    @IsNumber()
    @Min(0)
    amount: number

    @IsNumber()
    methodId: number

    @IsNumber()
    userId: number

    @IsOptional()
    @IsString()
    requisite?: string
}