import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class B2BSlotsUtilsService {
  /**
   * Generate signature for B2BSlots API requests
   * Placeholder: adjust to provider's signing rules from PDF
   */
  sign(params: Record<string, any>, secret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return crypto.createHash('md5').update(`${payload}${secret}`).digest('hex');
  }

  /**
   * Generate game URL for B2BSlots games
   * Based on documentation: https://int.apiforb2b.com/games/<game_name>.game
   */
  generateGameUrl(gameName: string, operatorId: number, userId: string, authToken: string, currency: string, language = 'EN', homeUrl?: string) {
    const baseUrl = 'https://int.apiforb2b.com/games';
    const params = new URLSearchParams({
      operator_id: operatorId.toString(),
      user_id: userId,
      auth_token: authToken,
      currency: currency,
      language: language
    });

    if (homeUrl) {
      params.append('home_url', homeUrl);
    }

    return `${baseUrl}/${gameName}.game?${params.toString()}`;
  }

  /**
   * Generate game URL by game code
   * Based on documentation: https://int.apiforb2b.com/gamesbycode/<game_code>.gamecode
   */
  generateGameUrlByCode(gameCode: number, operatorId: number, userId: string, authToken: string, currency: string, language = 'EN', homeUrl?: string) {
    const baseUrl = 'https://int.apiforb2b.com/gamesbycode';
    const params = new URLSearchParams({
      operator_id: operatorId.toString(),
      user_id: userId,
      auth_token: authToken,
      currency: currency,
      language: language
    });

    if (homeUrl) {
      params.append('home_url', homeUrl);
    }

    return `${baseUrl}/${gameCode}.gamecode?${params.toString()}`;
  }
}
