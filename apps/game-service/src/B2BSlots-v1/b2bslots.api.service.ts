import { Injectable } from '@nestjs/common';
import axios from 'axios';

// B2BSlots API endpoints based on documentation
const AUTH_API = '/do-auth-user-ingame';
const DEBIT_API = '/do-debit-user-ingame';
const CREDIT_API = '/do-credit-user-ingame';
const GET_FEATURES_API = '/do-get-features-user-ingame';
const ACTIVATE_FEATURES_API = '/do-activate-features-user-ingame';
const UPDATE_FEATURES_API = '/do-update-features-user-ingame';
const END_FEATURES_API = '/do-end-features-user-ingame';

// B2BSlots Games List API
const GET_GAMES_BY_OPERATOR = '/frontendsrv/apihandler.api';

// Legacy endpoints for compatibility
const GET_GAMES = '/games';
const GET_CURRENCIES = '/currencies';
const INIT_DEMO = '/session/demo';
const INIT_SESSION = '/session/start';
const FREE_ROUNDS_INFO = '/freerounds/info';
const CLOSE_SESSION = '/session/close';

@Injectable()
export class B2BSlotsApiService {
  /**
   * Authenticate user for game session (B2BSlots Auth API)
   */
  async authenticateUser(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${AUTH_API}`, body);
    return data;
  }

  /**
   * Process bet (debit) operation (B2BSlots Debit API)
   */
  async processBet(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${DEBIT_API}`, body);
    return data;
  }

  /**
   * Process win (credit) operation (B2BSlots Credit API)
   */
  async processWin(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${CREDIT_API}`, body);
    return data;
  }

  /**
   * Get available features (free rounds info) (B2BSlots Get Features API)
   */
  async getFeatures(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${GET_FEATURES_API}`, body);
    return data;
  }

  /**
   * Activate features (free rounds) (B2BSlots Activate Features API)
   */
  async activateFeatures(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${ACTIVATE_FEATURES_API}`, body);
    return data;
  }

  /**
   * Update features progress (B2BSlots Update Features API)
   */
  async updateFeatures(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${UPDATE_FEATURES_API}`, body);
    return data;
  }

  /**
   * End features (B2BSlots End Features API)
   */
  async endFeatures(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${END_FEATURES_API}`, body);
    return data;
  }

  /**
   * Get games list by operator ID (B2BSlots Games List API)
   */
  async getGamesByOperator(baseURL: string, operatorId: number | string) {
    const cmd = JSON.stringify({
      api: 'ls-games-by-operator-idget',
      operator_id: operatorId.toString()
    });

    const url = `${baseURL}${GET_GAMES_BY_OPERATOR}?cmd=${encodeURIComponent(cmd)}`;
    const { data } = await axios.get(url);
    return data;
  }

  // Legacy methods for compatibility with current interface
  async getGames(baseURL: string, operatorId?: number | string) {
    if (operatorId !== undefined) {
      return this.getGamesByOperator(baseURL, operatorId);
    }
    // Fallback to empty array if no operator ID provided
    return [];
  }

  async getCurrencies(baseURL: string) {
    // B2BSlots supports: BTC, LTC, USD, EUR, RUB, KZT, UAH
    return ['BTC', 'LTC', 'USD', 'EUR', 'RUB', 'KZT', 'UAH'];
  }

  async initDemo(baseURL: string, body: any) {
    // For demo mode, we still need to authenticate
    return this.authenticateUser(baseURL, body);
  }

  async initSession(baseURL: string, body: any) {
    return this.authenticateUser(baseURL, body);
  }

  async freeRoundsInfo(baseURL: string, body: any) {
    return this.getFeatures(baseURL, body);
  }

  async closeSession(baseURL: string, body: any) {
    // B2BSlots doesn't have explicit session close - sessions timeout automatically
    return { success: true, message: 'Session closed' };
  }
}
