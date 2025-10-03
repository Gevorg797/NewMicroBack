import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

/**
 * Custom exceptions for game service
 */

export class GameNotFoundException extends NotFoundException {
    constructor(gameId: number) {
        super(`Game with ID ${gameId} not found`);
    }
}

export class UnknownProviderException extends BadRequestException {
    constructor(gameId: number, providerName: string) {
        super(`Unknown provider for game ${gameId}: ${providerName}`);
    }
}

export class UnsupportedProviderException extends BadRequestException {
    constructor(providerName: string) {
        super(`Unsupported provider: ${providerName}`);
    }
}

export class ProviderSettingsNotFoundException extends NotFoundException {
    constructor(providerName: string) {
        super(`${providerName} provider settings not found`);
    }
}

export class ProviderConfigurationException extends InternalServerErrorException {
    constructor(envVar: string) {
        super(`${envVar} environment variable is not set`);
    }
}

export class ProviderApiException extends InternalServerErrorException {
    constructor(providerName: string, operation: string, originalError?: any) {
        super(`${providerName} API error during ${operation}: ${originalError?.message || 'Unknown error'}`);
    }
}
