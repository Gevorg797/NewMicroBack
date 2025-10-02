import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GameService, SessionPayload } from './game.service';

@Controller('game')
export class GameController {
    constructor(private readonly gameService: GameService) { }

    @MessagePattern('game.initGameSession')
    async initGameSession(
        @Payload() payload: SessionPayload
    ) {
        return this.gameService.initGameSession(payload);
    }

    @MessagePattern('game.initGameDemoSession')
    async initGameDemoSession(
        @Payload() payload: SessionPayload
    ) {
        return this.gameService.initGameDemoSession(payload);
    }

    @MessagePattern('game.gamesFreeRoundsInfo')
    async gamesFreeRoundsInfo(
        @Payload() payload: SessionPayload
    ) {
        return this.gameService.gamesFreeRoundsInfo(payload);
    }

    @MessagePattern('game.closeSession')
    async closeSession(
        @Payload() payload: SessionPayload
    ) {
        return this.gameService.closeSession(payload);
    }
}
