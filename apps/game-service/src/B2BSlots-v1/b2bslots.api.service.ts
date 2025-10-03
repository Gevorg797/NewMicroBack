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
      api: 'ls-games-by-operator-id-get',
      operator_id: operatorId.toString()
    });

    const url = `${baseURL}${GET_GAMES_BY_OPERATOR}?cmd=${cmd}`;
    const { data } = await axios.get(url);

    // Extract and normalize games from B2BSlots response structure
    return this.extractGamesFromResponse(data);
  }

  /**
   * Extract games from B2BSlots API response structure
   */
  private extractGamesFromResponse(response: any): any[] {
    if (!response || !response.success || !response.locator || !response.locator.groups) {
      console.warn('Invalid B2BSlots games response structure');
      return [];
    }

    const games: any[] = [];
    const { groups, ico_baseurl } = response.locator;


    // Flatten all games from all groups
    groups.forEach((group: any, groupIndex: number) => {
      // Check if group has a games array (like in your example)
      if (group && typeof group === 'object') {
        // Look for games array in the group
        const groupGames = group.games || group;

        if (Array.isArray(groupGames)) {
          groupGames.forEach((game: any, gameIndex: number) => {
            if (game && typeof game === 'object') {
              // Get the best icon (largest size available)
              const bestIcon = game.icons && Array.isArray(game.icons) && game.icons.length > 0
                ? game.icons.reduce((prev, current) => (current.ic_w > prev.ic_w) ? current : prev)
                : null;

              const iconUrl = bestIcon && ico_baseurl
                ? `${ico_baseurl}${bestIcon.ic_name}`
                : '';

              // Create normalized game object for database
              const normalizedGame = {
                // Core game fields (matching your DB structure)
                name: game.gm_title || game.title || game.name,
                uuid: String(game.gm_bk_id || game.id),
                type: 'slot', // B2BSlots games are typically slots
                technology: 'html5',
                isHasLobby: false,
                isMobile: game.gm_is_mobile || false,
                isHasFreeSpins: game.gm_is_fs || false,
                isHasTables: false,
                isFreeSpinValidUntilFullDay: false,
                isDesktop: game.gm_is_pc || false,
                image: iconUrl,

                // Provider and subProvider mapping
                provider: 'b2bslots',
                subProvider: group.gr_title || group.title || 'Unknown', // Category becomes subProvider

                // Store all B2BSlots specific data in metadata
                metadata: {
                  // Original B2BSlots fields
                  gm_is_board: game.gm_is_board,
                  gm_m_w: game.gm_m_w,
                  gm_ln: game.gm_ln,
                  gm_is_copy: game.gm_is_copy,
                  gm_url: game.gm_url,
                  gm_is_retro: game.gm_is_retro,
                  gm_bk_id: game.gm_bk_id,
                  gm_d_w: game.gm_d_w,
                  gm_m_h: game.gm_m_h,
                  gm_is_fs: game.gm_is_fs,
                  gm_is_mobile: game.gm_is_mobile,
                  gm_is_pc: game.gm_is_pc,
                  gm_new: game.gm_new,
                  gm_d_h: game.gm_d_h,

                  // Icons data
                  icons: game.icons,
                  icon_baseurl: ico_baseurl,
                  best_icon: bestIcon,

                  // Group information
                  group_id: group.gr_id,
                  group_title: group.gr_title,

                  // Provider identification
                  provider: 'b2bslots'
                }
              };
              games.push(normalizedGame);
            }
          });
        }
      }
    });
    return games;
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
