import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Superomatic API endpoints based on https://demo.superomatic.biz/doc/
const GET_GAMES = '/games.list';
const GET_CURRENCIES = '/currencies.list';
const GET_GAME_DEMO_SESSION = '/init.demo.session';
const GET_GAME_SESSION = '/init.session';
const GAMES_FREE_ROUNDS_INFO = '/games.freeroundsInfo';

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
    const { data } = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });
    const { response } = data;
    return response;
  }

  async getGameSession(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GET_GAME_SESSION}`;
    const { data } = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });
    const { response } = data;
    return response;
  }

  async gamesFreeRoundsInfo(baseURL: string, requestBody: Record<string, any>) {
    const url = `${baseURL}${GAMES_FREE_ROUNDS_INFO}`;
    const { data } = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });
    const { response } = data;
    return response;
  }
}
