import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject } from 'class-validator';

export class GameSessionDto {
    @ApiProperty({ description: 'User ID', example: 1 })
    @IsNumber()
    userId: number;

    @ApiProperty({ description: 'Site ID', example: 1 })
    @IsNumber()
    siteId: number;

    @ApiProperty({ description: 'Session parameters', example: { gameId: 'game123' } })
    @IsObject()
    params: any;
}
