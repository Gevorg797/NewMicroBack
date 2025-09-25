import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { LoadGamesDto } from './dto/load-games.dto';
import { GetCurrenciesDto } from './dto/get-currencies.dto';
import { GameSessionDto } from './dto/game-session.dto';

@ApiTags('Games')
@Controller('games')
export class GamesController {
    constructor(private readonly gamesService: GamesService) { }

    @Post(':provider/load-games')
    @ApiOperation({ summary: 'Load games from game provider' })
    @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    @ApiResponse({ status: 200, description: 'Games loaded successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async loadGames(
        @Param('provider') provider: string,
        @Body() data: LoadGamesDto,
    ) {
        return this.gamesService.loadGames(provider, data);
    }

    @Post(':provider/currencies')
    @ApiOperation({ summary: 'Get currencies from game provider' })
    @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    @ApiResponse({ status: 200, description: 'Currencies retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getCurrencies(
        @Param('provider') provider: string,
        @Body() data: GetCurrenciesDto,
    ) {
        return this.gamesService.getCurrencies(provider, data);
    }

    @Post(':provider/demo-session')
    @ApiOperation({ summary: 'Initialize demo game session' })
    @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    @ApiResponse({ status: 200, description: 'Demo session initialized successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async initGameDemoSession(
        @Param('provider') provider: string,
        @Body() data: GameSessionDto,
    ) {
        return this.gamesService.initGameDemoSession(provider, data);
    }

    @Post(':provider/session')
    @ApiOperation({ summary: 'Initialize real game session' })
    @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    @ApiResponse({ status: 200, description: 'Game session initialized successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async initGameSession(
        @Param('provider') provider: string,
        @Body() data: GameSessionDto,
    ) {
        return this.gamesService.initGameSession(provider, data);
    }

    @Post(':provider/free-rounds')
    @ApiOperation({ summary: 'Get free rounds information' })
    @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    @ApiResponse({ status: 200, description: 'Free rounds info retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async gamesFreeRoundsInfo(
        @Param('provider') provider: string,
        @Body() data: GameSessionDto,
    ) {
        return this.gamesService.gamesFreeRoundsInfo(provider, data);
    }

    // @Post(':provider/test-connection')
    // @ApiOperation({ summary: 'Test connection to game provider' })
    // @ApiParam({ name: 'provider', description: 'Game provider name (superomatic, b2bslots)', example: 'superomatic' })
    // @ApiResponse({ status: 200, description: 'Connection test successful' })
    // @ApiResponse({ status: 400, description: 'Bad request' })
    // @ApiResponse({ status: 500, description: 'Internal server error' })
    // async testConnection(
    //     @Param('provider') provider: string,
    //     @Body() data: { userId: number; siteId: number },
    // ) {
    //     return this.gamesService.testConnection(provider, data);
    // }
}
