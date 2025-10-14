import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GameService } from './game.service';
import { InitGameSessionDto } from './dto/init-game-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@ApiTags('Game Client')
@Controller('client/game')
export class GameController {
  constructor(private readonly gameService: GameService) { }

  @Post('init-session')
  @ApiOperation({
    summary: 'Initialize a game session',
    description: 'Creates a new game session for a user. The request is automatically routed to the correct game provider based on the gameId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Game session initialized successfully',
    schema: {
      example: {
        sessionId: 'abc123',
        gameUrl: 'https://game-provider.com/play?session=abc123',
        expiresAt: '2025-10-14T12:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters'
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async initGameSession(@Body() dto: InitGameSessionDto) {
    return this.gameService.initGameSession(dto);
  }

  @Post('close-session')
  @ApiOperation({
    summary: 'Close a game session',
    description: 'Closes an active game session for a user. The session is automatically identified from the userId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Game session closed successfully',
    schema: {
      example: {
        success: true,
        message: 'Session closed successfully',
        finalBalance: 1000.50,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - No active session found'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async closeSession(@Body() dto: CloseSessionDto) {
    return this.gameService.closeSession(dto);
  }
}

