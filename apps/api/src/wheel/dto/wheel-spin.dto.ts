import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum RecoilType {
    BAD = 'bad',
    NORMAL = 'normal',
    GOOD = 'good',
    SUPER = 'super',
}

export class WheelSpinDto {
    @ApiProperty({ enum: RecoilType, description: 'Distribution preset' })
    @IsEnum(RecoilType)
    recoilType: RecoilType;
}

export class WheelSpinResponseDto {
    @ApiProperty({ example: 150 })
    amount: number;

    @ApiProperty({ example: 3 })
    index: number;

    @ApiProperty({ type: [Number], example: [3, 5, 5, 7, 7, 10, 10, 15, 18, 20] })
    distribution: number[];
}


