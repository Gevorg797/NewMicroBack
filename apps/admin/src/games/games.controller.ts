import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { LoadGamesDto } from './dto/load-games.dto';
import { GetCurrenciesDto } from './dto/get-currencies.dto';
import { GameSessionDto } from './dto/game-session.dto';
import { CheckBalanceDto } from './dto/check-balance.dto';
import { GameHistoryDto } from './dto/game-history.dto';
import { GameStatisticsDto } from './dto/game-statistics.dto';
import { ProviderInfoDto } from './dto/provider-info.dto';
import { SessionManagementDto } from './dto/session-management.dto';

@ApiTags('Superomatic Games')
@Controller('games')
export class GamesController {
    constructor(private readonly gamesService: GamesService) { }

    @Post('load-games')
    @ApiOperation({ summary: 'Load games from Superomatic' })
    @ApiResponse({ status: 200, description: 'Games loaded successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async loadGames(@Body() data: LoadGamesDto) {
        return this.gamesService.loadGames(data);
    }

    @Post('currencies')
    @ApiOperation({ summary: 'Get currencies from Superomatic' })
    @ApiResponse({ status: 200, description: 'Currencies retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getCurrencies(@Body() data: GetCurrenciesDto) {
        return this.gamesService.getCurrencies(data);
    }

    @Post('demo-session')
    @ApiOperation({ summary: 'Initialize demo game session' })
    @ApiResponse({ status: 200, description: 'Demo session initialized successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async initGameDemoSession(@Body() data: GameSessionDto) {
        return this.gamesService.initGameDemoSession(data);
    }

    @Post('session')
    @ApiOperation({ summary: 'Initialize real game session' })
    @ApiResponse({ status: 200, description: 'Game session initialized successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async initGameSession(@Body() data: GameSessionDto) {
        return this.gamesService.initGameSession(data);
    }

    @Post('free-rounds')
    @ApiOperation({ summary: 'Get free rounds information' })
    @ApiResponse({ status: 200, description: 'Free rounds info retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async gamesFreeRoundsInfo(@Body() data: GameSessionDto) {
        return this.gamesService.gamesFreeRoundsInfo(data);
    }

    @Post('check-balance')
    @ApiOperation({ summary: 'Check user balance' })
    @ApiResponse({ status: 200, description: 'Balance checked successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async checkBalance(@Body() data: CheckBalanceDto) {
        return this.gamesService.checkBalance(data);
    }

    @Post('game-history')
    @ApiOperation({ summary: 'Get game history' })
    @ApiResponse({ status: 200, description: 'Game history retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getGameHistory(@Body() data: GameHistoryDto) {
        return this.gamesService.getGameHistory(data);
    }

    @Post('game-statistics')
    @ApiOperation({ summary: 'Get game statistics' })
    @ApiResponse({ status: 200, description: 'Game statistics retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getGameStatistics(@Body() data: GameStatisticsDto) {
        return this.gamesService.getGameStatistics(data);
    }

    @Post('provider-info')
    @ApiOperation({ summary: 'Get provider information' })
    @ApiResponse({ status: 200, description: 'Provider info retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getProviderInfo(@Body() data: ProviderInfoDto) {
        return this.gamesService.getProviderInfo(data);
    }


    @Post('close-session')
    @ApiOperation({ summary: 'Close user session' })
    @ApiResponse({ status: 200, description: 'Session closed successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async closeSession(@Body() data: SessionManagementDto) {
        return this.gamesService.closeSession(data);
    }
}
