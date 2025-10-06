import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GameService } from './game.service';
import { SessionPayload, LoadGamesPayload } from './interfaces/game-provider.interface';

@Controller('game')
export class GameController {
    private readonly logger = new Logger(GameController.name);

    constructor(private readonly gameService: GameService) {
        this.logger.log('GameController initialized');
    }

    @MessagePattern('game.initGameSession')
    async initGameSession(@Payload() payload: SessionPayload): Promise<any> {
        this.logger.debug(`Received initGameSession request for game: ${payload.gameId}`);
        return this.gameService.initGameSession(payload);
    }

    @MessagePattern('game.initGameDemoSession')
    async initGameDemoSession(@Payload() payload: SessionPayload): Promise<any> {
        this.logger.debug(`Received initGameDemoSession request for game: ${payload.gameId}`);
        return this.gameService.initGameDemoSession(payload);
    }

    @MessagePattern('game.gamesFreeRoundsInfo')
    async gamesFreeRoundsInfo(@Payload() payload: SessionPayload): Promise<any> {
        this.logger.debug(`Received gamesFreeRoundsInfo request for game: ${payload.gameId}`);
        return this.gameService.gamesFreeRoundsInfo(payload);
    }

    @MessagePattern('game.closeSession')
    async closeSession(@Payload() payload: SessionPayload): Promise<any> {
        this.logger.debug(`Received closeSession request for game: ${payload.gameId}`);
        return this.gameService.closeSession(payload);
    }

    @MessagePattern('game.loadGames')
    async loadGames(@Payload() payload: LoadGamesPayload): Promise<any> {
        this.logger.debug(`Received loadGames request for provider: ${payload.providerName}`);
        return this.gameService.loadGames(payload);
    }

    @MessagePattern('game.getCurrencies')
    async getCurrencies(@Payload() payload: SessionPayload): Promise<any> {
        this.logger.debug(`Received getCurrencies request for game: ${payload.gameId}`);
        return this.gameService.getCurrencies(payload);
    }
}
