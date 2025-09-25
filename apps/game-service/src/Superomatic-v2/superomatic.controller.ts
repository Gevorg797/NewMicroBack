import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SuperomaticService } from './superomatic.service';

@Controller('superomatic')
export class SuperomaticController {
  constructor(private readonly superomaticService: SuperomaticService) { }

  @MessagePattern('superomatic.loadGames')
  async loadGames(
    @Payload() payload: { userId: number; siteId: number; params?: any },
  ) {
    return this.superomaticService.loadGames(payload);
  }

  @MessagePattern('superomatic.getCurrencies')
  async getCurrencies(@Payload() payload: { userId: number; siteId: number }) {
    return this.superomaticService.getCurrencies(payload);
  }

  @MessagePattern('superomatic.initGameDemoSession')
  async initGameDemoSession(
    @Payload()
    payload: {
      userId: number;
      siteId: number;
      params: any;
    },
  ) {
    return this.superomaticService.initGameDemoSession(payload);
  }

  @MessagePattern('superomatic.initGameSession')
  async initGameSession(
    @Payload()
    payload: {
      userId: number;
      siteId: number;
      params: any;
    },
  ) {
    return this.superomaticService.initGameSession(payload);
  }

  @MessagePattern('superomatic.gamesFreeRoundsInfo')
  async gamesFreeRoundsInfo(
    @Payload()
    payload: {
      userId: number;
      siteId: number;
      params: any;
    },
  ) {
    return this.superomaticService.gamesFreeRoundsInfo(payload);
  }

  @MessagePattern('superomatic.checkBalance')
  async checkBalance(@Payload() payload: any) {
    return this.superomaticService.checkBalance(payload);
  }
}
