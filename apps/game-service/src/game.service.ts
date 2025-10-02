import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Game, GameProvider } from '@lib/database';
import { SuperomaticService } from './Superomatic-v2/superomatic.service';
import { B2BSlotsService } from './B2BSlots-v1/b2bslots.service';

/**
 * Payload interface for session-related requests that require gameId-based routing
 */
export interface SessionPayload {
    userId: number;
    siteId: number;
    gameId: number; // This is the key field used for provider routing
    params: any;
}

/**
 * Main Game Service that routes requests to appropriate providers based on gameId
 * 
 * This service acts as a router that:
 * 1. Receives requests with gameId
 * 2. Queries the database to determine which provider the game belongs to
 * 3. Routes the request to the appropriate provider service (Superomatic or B2BSlots)
 * 
 * Usage:
 * - For session creation requests, use the unified message patterns:
 *   - 'game.initGameSession' instead of 'superomatic.initGameSession' or 'b2bslots.initGameSession'
 *   - 'game.initGameDemoSession' instead of provider-specific patterns
 *   - 'game.gamesFreeRoundsInfo' instead of provider-specific patterns
 *   - 'game.closeSession' instead of provider-specific patterns
 * 
 * - The payload must include gameId which will be used to determine the provider
 * - The gameId will be removed from the payload before forwarding to provider services
 */
@Injectable()
export class GameService {
    constructor(
        private readonly em: EntityManager,
        private readonly superomaticService: SuperomaticService,
        private readonly b2bSlotsService: B2BSlotsService,
    ) { }

    /**
     * Determines which provider a game belongs to based on gameId
     */
    async getGameProvider(gameId: number) {
        const game = await this.em.findOne(
            Game,
            { id: gameId },
            { populate: ['subProvider.provider'] }
        );

        if (!game) {
            throw new BadRequestException(`Game with ID ${gameId} not found`);
        }

        const providerName = game.subProvider.provider.name.toLowerCase();
        const gameIdStr = game.uuid.toString();

        // Map provider names to service identifiers
        if (providerName.includes('superomatic')) {
            return { providerName, gameIdStr };
        } else if (providerName.includes('b2b') || providerName.includes('b2bslots')) {
            return { providerName, gameIdStr };
        }

        throw new BadRequestException(`Unknown provider for game ${gameId}: ${providerName}`);
    }

    /**
     * Routes session creation requests to the appropriate provider
     */
    async initGameSession(payload: SessionPayload) {
        const provider = await this.getGameProvider(payload.gameId);
        payload.params.gameId = provider.gameIdStr;


        switch (provider.providerName) {
            case 'superomatic':
                return this.superomaticService.initGameSession(payload);
            case 'b2bslots':
                return this.b2bSlotsService.initGameSession(payload);
            default:
                throw new BadRequestException(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Routes demo session creation requests to the appropriate provider
     */
    async initGameDemoSession(payload: SessionPayload) {
        const provider = await this.getGameProvider(payload.gameId);
        payload.params.gameId = provider.gameIdStr;


        switch (provider.providerName) {
            case 'superomatic':
                return this.superomaticService.initGameDemoSession(payload);
            case 'b2bslots':
                return this.b2bSlotsService.initGameDemoSession(payload);
            default:
                throw new BadRequestException(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Routes free rounds info requests to the appropriate provider
     */
    async gamesFreeRoundsInfo(payload: SessionPayload) {
        const provider = await this.getGameProvider(payload.gameId);
        payload.params.gameId = provider.gameIdStr;

        switch (provider.providerName) {
            case 'superomatic':
                return this.superomaticService.gamesFreeRoundsInfo(payload);
            case 'b2bslots':
                return this.b2bSlotsService.gamesFreeRoundsInfo(payload);
            default:
                throw new BadRequestException(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Routes close session requests to the appropriate provider
     */
    async closeSession(payload: SessionPayload) {
        const provider = await this.getGameProvider(payload.gameId);
        payload.params.gameId = provider.gameIdStr;


        switch (provider.providerName) {
            case 'superomatic':
                return this.superomaticService.closeSession(payload);
            case 'b2bslots':
                return this.b2bSlotsService.closeSession(payload);
            default:
                throw new BadRequestException(`Unsupported provider: ${provider}`);
        }
    }
}
