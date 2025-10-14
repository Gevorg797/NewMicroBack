import { Injectable, Logger } from '@nestjs/common';
import { MsGameService } from 'libs/microservices-clients/ms-game/ms-game.service';
import { InitGameSessionDto } from './dto/init-game-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly msGameService: MsGameService) { }

  /**
   * Initialize a game session
   */
  async initGameSession(dto: InitGameSessionDto) {
    this.logger.log(`Initializing game session for user ${dto.userId}, game ${dto.gameId}`);


    const result = await this.msGameService.initGameSession({
      userId: dto.userId,
      siteId: dto.siteId,
      gameId: dto.gameId,
      balanceType: dto.balanceType,
      params: dto.params || {},
    });

    this.logger.log(`Game session initialized successfully for user ${dto.userId}`);
    return result;
  }

  /**
   * Close a game session
   */
  async closeSession(dto: CloseSessionDto) {
    this.logger.log(`Closing game session for user ${dto.userId}`);


    const result = await this.msGameService.closeSession({
      userId: dto.userId,
    });

    return result;
  }
}

