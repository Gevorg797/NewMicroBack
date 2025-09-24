// libs/database/src/entities/currency.entity.ts
import { Collection, Entity, OneToMany, Property, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { GamesProviderSettingGroup } from './game-provider-settings-group.entity';
import { Balances } from './balances.entity';

export enum CurrencyType {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
  KZT = 'KZT',
  GBP = 'GBP',
  JPY = 'JPY',
  CNY = 'CNY',
  CAD = 'CAD',
  AUD = 'AUD',
  CHF = 'CHF',
  SEK = 'SEK',
  NOK = 'NOK',
  DKK = 'DKK',
  PLN = 'PLN',
  CZK = 'CZK',
  HUF = 'HUF',
  RON = 'RON',
  BGN = 'BGN',
  HRK = 'HRK',
  TRY = 'TRY',
  BRL = 'BRL',
  MXN = 'MXN',
  ZAR = 'ZAR',
  INR = 'INR',
  KRW = 'KRW',
  SGD = 'SGD',
  HKD = 'HKD',
  NZD = 'NZD',
  THB = 'THB',
  MYR = 'MYR',
  PHP = 'PHP',
  IDR = 'IDR',
  VND = 'VND',
  UAH = 'UAH',
  BYN = 'BYN',
  KGS = 'KGS',
  TJS = 'TJS',
  UZS = 'UZS',
  AMD = 'AMD',
  GEL = 'GEL',
  AZN = 'AZN',
  MDL = 'MDL',
}

@Entity({ tableName: 'currencies' })
export class Currency extends BaseEntity {
  @Enum(() => CurrencyType)
  name!: CurrencyType;

  @Property({ length: 10 })
  symbol!: string; // Currency symbol like ₽, $, €, ₸, etc.

  @Property({ columnType: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => GamesProviderSettingGroup, (group) => group.currency)
  groups = new Collection<GamesProviderSettingGroup>(this);

  @OneToMany(() => Balances, (balance) => balance.currency)
  balances = new Collection<Balances>(this);
}
