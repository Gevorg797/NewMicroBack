import { IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base DTO for session-related requests
 */
export class SessionPayloadDto {
    @IsNumber()
    userId: number;

    @IsNumber()
    siteId: number;

    @IsNumber()
    gameId: number;

    @IsObject()
    @ValidateNested()
    @Type(() => Object)
    params: Record<string, any>;
}

/**
 * DTO for game session initialization
 */
export class InitGameSessionDto extends SessionPayloadDto {
    @IsObject()
    @ValidateNested()
    @Type(() => GameSessionParamsDto)
    declare params: GameSessionParamsDto;
}

/**
 * DTO for demo session initialization
 */
export class InitDemoSessionDto extends SessionPayloadDto {
    @IsObject()
    @ValidateNested()
    @Type(() => DemoSessionParamsDto)
    declare params: DemoSessionParamsDto;
}

/**
 * Parameters for game session initialization
 */
export class GameSessionParamsDto {
    @IsOptional()
    partnerAlias?: string;

    @IsOptional()
    partnerSession?: string;

    @IsOptional()
    currency?: string;

    @IsOptional()
    freeroundsId?: string;

    @IsOptional()
    gameId?: string; // Will be set by the service
}

/**
 * Parameters for demo session initialization
 */
export class DemoSessionParamsDto {
    @IsOptional()
    @IsNumber()
    balance?: number;

    @IsOptional()
    @IsNumber()
    denomination?: number;

    @IsOptional()
    currency?: string;

    @IsOptional()
    gameId?: string; // Will be set by the service
}

/**
 * DTO for load games request
 */
export class LoadGamesDto {
    @IsNumber()
    siteId: number;

    @IsString()
    providerName: string;

    @IsOptional()
    @IsObject()
    params?: {
        isHardReset?: boolean;
        [key: string]: any;
    };
}

/**
 * DTO for get currencies request
 */
export class GetCurrenciesDto {
    @IsNumber()
    userId: number;

    @IsNumber()
    siteId: number;
}
