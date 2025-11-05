import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class B2BSlotsUtilsService {
  /**
   * Generate signature for B2BSlots API requests
   * Based on B2BSlots documentation:
   * 1. Sort parameters alphabetically
   * 2. Create query string format: key1=value1&key2=value2
   * 3. Append secret key
   * 4. Calculate MD5 hash
   */
  sign(params: Record<string, any>, secret: string): string {
    // Filter out undefined/null values
    const validParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const stringToSign = `${validParams}${secret}`;
    return crypto.createHash('md5').update(stringToSign).digest('hex');
  }

  /**
   * Verify signature for B2BSlots webhook requests
   */
  verifySignature(params: Record<string, any>, receivedSignature: string, secret: string): boolean {
    const expectedSignature = this.sign(params, secret);
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Generate game URL for B2BSlots games
   * @param baseURL - Base URL from provider settings (e.g., https://int.apiforb2b.com)
   * @param gameName - Game name identifier
   * @param operatorId - Operator ID from provider settings
   * @param userId - User ID
   * @param authToken - Session auth token (session UUID)
   * @param currency - Currency code (USD, EUR, etc.)
   * @param language - Language code (default: EN)
   * @param homeUrl - Optional home URL for mobile version
   */
  generateGameUrl(baseURL: string, gameName: string, operatorId: number, userId: string, authToken: string, currency: string, language = 'EN', homeUrl?: string) {
    // Remove trailing slash from baseURL if present
    const cleanBaseURL = baseURL.replace(/\/$/, '');

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

    return `${cleanBaseURL}/games/${gameName}.game?${params.toString()}`;
  }

  /**
   * Generate game URL by game code
   * @param baseURL - Base URL from provider settings (e.g., https://int.apiforb2b.com)
   * @param gameCode - Numeric game code
   * @param operatorId - Operator ID from provider settings
   * @param userId - User ID
   * @param authToken - Session auth token (session UUID)
   * @param currency - Currency code (USD, EUR, etc.)
   * @param language - Language code (default: EN)
   * @param homeUrl - Optional home URL for mobile version
   */
  generateGameUrlByCode(baseURL: string, gameCode: number, operatorId: number, userId: string, authToken: string, currency: string, language = 'EN', homeUrl?: string) {
    // Remove trailing slash from baseURL if present
    const cleanBaseURL = baseURL.replace(/\/$/, '');

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

    return `${cleanBaseURL}/gamesbycode/${gameCode}.gamecode?${params.toString()}`;
  }
}
