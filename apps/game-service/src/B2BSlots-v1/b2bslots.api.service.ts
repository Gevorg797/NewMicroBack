import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Placeholder endpoints; replace with actual from PDF
const GET_GAMES = '/games';
const GET_CURRENCIES = '/currencies';
const INIT_DEMO = '/session/demo';
const INIT_SESSION = '/session/start';
const FREE_ROUNDS_INFO = '/freerounds/info';

@Injectable()
export class B2BSlotsApiService {
  async getGames(baseURL: string) {
    const { data } = await axios.get(`${baseURL}${GET_GAMES}`);
    return data;
  }

  async getCurrencies(baseURL: string) {
    const { data } = await axios.get(`${baseURL}${GET_CURRENCIES}`);
    return data;
  }

  async initDemo(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${INIT_DEMO}`, body);
    return data;
  }

  async initSession(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${INIT_SESSION}`, body);
    return data;
  }

  async freeRoundsInfo(baseURL: string, body: any) {
    const { data } = await axios.post(`${baseURL}${FREE_ROUNDS_INFO}`, body);
    return data;
  }
}
