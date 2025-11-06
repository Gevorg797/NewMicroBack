import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Game, GameSession } from '@lib/database';
import { IGameProvider, GameProviderInfo } from '../interfaces/game-provider.interface';
import { SuperomaticService } from '../Superomatic-v2/superomatic.service';
import { B2BSlotsService } from '../B2BSlots-v1/b2bslots.service';
import { PROVIDER_NAMES, PROVIDER_IDENTIFIERS } from '../constants/provider.constants';
import {
    GameNotFoundException,
    UnknownProviderException,
    UnsupportedProviderException
} from '../exceptions/game-service.exceptions';

/**
 * Factory for creating provider strategy instances
 * Implements Strategy pattern to eliminate switch statements and improve extensibility
 */
@Injectable()
export class ProviderStrategyFactory {
    private readonly logger = new Logger(ProviderStrategyFactory.name);
    private readonly providerMap = new Map<string, IGameProvider>();

    constructor(
        private readonly em: EntityManager,
        private readonly superomaticService: SuperomaticService,
        private readonly b2bSlotsService: B2BSlotsService,
    ) {
        this.initializeProviderMap();
    }

    /**
     * Initialize the provider mapping
     */
    private initializeProviderMap(): void {
        this.providerMap.set(PROVIDER_NAMES.SUPEROMATIC, this.superomaticService);
        this.providerMap.set(PROVIDER_NAMES.B2B_SLOTS, this.b2bSlotsService);

        this.logger.log(`Initialized ${this.providerMap.size} provider strategies`);
    }

    /**
     * Get provider information for a given game ID
     */
    async getGameProvider(gameId: number): Promise<GameProviderInfo> {
        this.logger.debug(`Looking up provider for game ID: ${gameId}`);

        const game = await this.em.findOne(
            Game,
            { id: gameId },
            { populate: ['subProvider.provider'] }
        );

        if (!game) {
            this.logger.error(`Game not found: ${gameId}`);
            throw new GameNotFoundException(gameId);
        }

        const providerName = game.subProvider.provider.name.toLowerCase();
        const gameIdStr = game.uuid.toString();

        this.logger.debug(`Found provider: ${providerName} for game: ${gameId}`);

        const normalizedProviderName = this.normalizeProviderName(providerName);

        if (!normalizedProviderName) {
            this.logger.error(`Unknown provider: ${providerName} for game: ${gameId}`);
            throw new UnknownProviderException(gameId, providerName);
        }

        return { providerName: normalizedProviderName, gameId, gameIdStr };
    }

    /**
     * Get provider strategy instance
     */
    getProviderStrategy(providerName: string): IGameProvider {
        const strategy = this.providerMap.get(providerName);

        if (!strategy) {
            this.logger.error(`No strategy found for provider: ${providerName}`);
            throw new UnsupportedProviderException(providerName);
        }

        return strategy;
    }

    /**
     * Normalize provider name to standard identifier
     */
    private normalizeProviderName(providerName: string): string | null {
        const lowerProviderName = providerName.toLowerCase();

        // Check Superomatic identifiers
        if (PROVIDER_IDENTIFIERS.SUPEROMATIC.some(id => lowerProviderName.includes(id))) {
            return PROVIDER_NAMES.SUPEROMATIC;
        }

        // Check B2BSlots identifiers
        if (PROVIDER_IDENTIFIERS.B2B_SLOTS.some(id => lowerProviderName.includes(id))) {
            return PROVIDER_NAMES.B2B_SLOTS;
        }

        return null;
    }

    /**
     * Get provider information from session ID
     * Used for operations that don't have gameId (closeSession, gamesFreeRoundsInfo)
     */
    async getProviderFromSession(sessionId: string): Promise<string> {
        this.logger.debug(`Looking up provider for session ID: ${sessionId}`);

        const session = await this.em.findOne(
            GameSession,
            { id: parseInt(sessionId) },
            { populate: ['game.subProvider.provider'] }
        );

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const providerName = session.game.subProvider.provider.name.toLowerCase();
        this.logger.debug(`Found provider: ${providerName} for session: ${sessionId}`);

        const normalizedProviderName = this.normalizeProviderName(providerName);

        if (!normalizedProviderName) {
            this.logger.error(`Unknown provider: ${providerName} for session: ${sessionId}`);
            throw new Error(`Unknown provider: ${providerName}`);
        }

        return normalizedProviderName;
    }

    /**
     * Get provider information from user ID
     * Finds user's active session and determines provider from it
     */
    async getProviderFromUserId(userId: number): Promise<string> {
        this.logger.debug(`Looking up provider for user ID: ${userId}`);

        const session = await this.em.findOne(
            GameSession,
            {
                user: { id: userId },
                isAlive: true
            },
            { populate: ['game.subProvider.provider'] }
        );

        if (!session) {
            throw new Error(`No active session found for user: ${userId}`);
        }

        const providerName = session.game.subProvider.provider.name.toLowerCase();
        this.logger.debug(`Found provider: ${providerName} for user: ${userId}`);

        const normalizedProviderName = this.normalizeProviderName(providerName);

        if (!normalizedProviderName) {
            this.logger.error(`Unknown provider: ${providerName} for user: ${userId}`);
            throw new Error(`Unknown provider: ${providerName}`);
        }

        return normalizedProviderName;
    }

    /**
     * Get all available provider names
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providerMap.keys());
    }
}
