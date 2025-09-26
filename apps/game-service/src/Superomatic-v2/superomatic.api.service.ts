import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Superomatic API endpoints based on https://demo.superomatic.biz/doc/
const GET_GAMES = '/games.list';
const GET_CURRENCIES = '/currencies.list';
const GET_GAME_DEMO_SESSION = '/init.demo.session';
const GET_GAME_SESSION = '/init.session';
const GAMES_FREE_ROUNDS_INFO = '/games.freeroundsInfo';
const CHECK_BALANCE = '/balance.check';
const GET_GAME_HISTORY = '/games.history';
const GET_GAME_STATISTICS = '/games.statistics';
const GET_PROVIDER_INFO = '/provider.info';
const TRX_CANCEL = '/trx.cancel';
const TRX_COMPLETE = '/trx.complete';
const CHECK_SESSION = '/check.session';
const WITHDRAW_BET = '/withdraw.bet';
const DEPOSIT_WIN = '/deposit.win';
const CREATE_SESSION = '/session.create';

@Injectable()
export class SuperomaticApiService {
  async getGames(baseURL: string, params: any = {}) {
    const url = `${baseURL}${GET_GAMES}`;
    const { data } = await axios.get(url, {
      headers: { 'Content-Type': 'application/json' },
      params: {
        // Default parameters for Superomatic games API
        limit: params.limit || 100,
        offset: params.offset || 0,
        ...params
      }
    });
    return data;
  }

  async getCurrenciesList(baseURL: string) {
    const url = `${baseURL}${GET_CURRENCIES}`;
    const { data } = await axios.get(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    const { response } = data;
    return response;
  }

  async getGameDemoSession(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_GAME_DEMO_SESSION}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getGameSession(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_GAME_SESSION}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async gamesFreeRoundsInfo(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GAMES_FREE_ROUNDS_INFO}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async checkBalance(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${CHECK_BALANCE}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getGameHistory(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_GAME_HISTORY}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getGameStatistics(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_GAME_STATISTICS}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getProviderInfo(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_PROVIDER_INFO}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async cancelTransaction(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${TRX_CANCEL}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async completeTransaction(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${TRX_COMPLETE}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async checkSession(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${CHECK_SESSION}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async withdrawBet(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${WITHDRAW_BET}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async depositWin(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${DEPOSIT_WIN}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async createSession(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${CREATE_SESSION}`;
    try {
      const { data } = await axios.get(url, {
        params: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }
}
