import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { B2BSlotsService } from './b2bslots.service';

@Controller('b2bslots')
export class B2BSlotsController {
  constructor(private readonly service: B2BSlotsService) { }

  @MessagePattern('b2bslots.loadGames')
  loadGames(
    @Payload() payload: { siteId: number; params?: any },
  ) {
    return this.service.loadGames(payload);
  }

  @MessagePattern('b2bslots.getCurrencies')
  getCurrencies(@Payload() payload: { userId: number; siteId: number }) {
    return this.service.getCurrencies(payload);
  }

  @MessagePattern('b2bslots.initGameDemoSession')
  initGameDemoSession(
    @Payload() payload: { userId: number; siteId: number; params: any },
  ) {
    return this.service.initGameDemoSession(payload);
  }

  @MessagePattern('b2bslots.initGameSession')
  initGameSession(
    @Payload() payload: { userId: number; siteId: number; params: any },
  ) {
    return this.service.initGameSession(payload);
  }

  @MessagePattern('b2bslots.gamesFreeRoundsInfo')
  gamesFreeRoundsInfo(
    @Payload() payload: { userId: number; siteId: number; params: any },
  ) {
    return this.service.gamesFreeRoundsInfo(payload);
  }
}
