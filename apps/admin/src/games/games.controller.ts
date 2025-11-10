import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { LoadGamesDto } from './dto/load-games.dto';
import { GetCurrenciesDto } from './dto/get-currencies.dto';
import { GameSessionDto } from './dto/game-session.dto';
import { GameHistoryDto } from './dto/game-history.dto';
import { GameStatisticsDto } from './dto/game-statistics.dto';
import { ProviderInfoDto } from './dto/provider-info.dto';
import { SessionManagementDto } from './dto/session-management.dto';
import { ApiPaginated, PaginateQuery } from 'libs/utils/pagination';
import { Game } from '@lib/database';

@ApiTags('Games Management')
@Controller('games')
export class GamesController {
    constructor(private readonly gamesService: GamesService) { }

    @Post('load-superomatic-games')
    @ApiOperation({ summary: 'Load games from Superomatic' })
    @ApiResponse({ status: 200, description: 'Games loaded successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async loadGames(@Body() data: LoadGamesDto) {
        return this.gamesService.loadGames(data);
    }

    @Post('load-b2bslots-games')
    @ApiOperation({ summary: 'Load games from B2BSlots provider' })
    @ApiResponse({ status: 200, description: 'B2BSlots games loaded successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async loadB2BSlotsGames(@Body() data: LoadGamesDto) {
        return this.gamesService.loadB2BSlotsGames(data);
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

    @Post('close-session')
    @ApiOperation({
        summary: 'Close user session',
        description: 'Close user active session. Only userId is required - siteId and gameId are determined automatically from the user\'s active session.'
    })
    @ApiResponse({ status: 200, description: 'Session closed successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async closeSession(@Body() data: SessionManagementDto) {
        return this.gamesService.closeSession(data);
    }

    @Get()
    @ApiOperation({ summary: 'Get games with pagination' })
    @ApiPaginated(Game)
    @ApiResponse({ status: 200, description: 'Games retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getGames(@Query() query: PaginateQuery) {
        return this.gamesService.getGames(query);
    }

    @Get('b2b-games-by-provider')
    @ApiOperation({ summary: 'Get all B2B games grouped by sub-providers' })
    @ApiResponse({ status: 200, description: 'B2B games retrieved successfully' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async getB2BGamesWithProviders() {
        return this.gamesService.getB2BGamesWithProviders();
    }
}
