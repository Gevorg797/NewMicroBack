import {
  Collection,
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  OneToOne,
} from '@mikro-orm/core';
import { FinanceProviderSettings } from './finance-provider-settings.entity';
import { BaseEntity } from './base.entity';
import { FinanceProviderSubMethods } from './finance-provider-sub-method.entity';
import { PaymentMethodImage } from './finance-provider-image-method.entity';

export enum MethodEnum {
  SBP = 'SBP',
  P2P = 'P2P',
  SBP_LOWERCASE = 'sbp',
  ANY_BANK = 'any-bank',
  CARD = 'CARD',
  FPS_H2H = 'FPS_H2H',
  P2P_H2H = 'P2P_H2H',
  FPS = 'FPS',
  CPS = 'CPS',
  SBP_RUB = 'sbp_rub',
  SBERBANK_RUB = 'sberbank_rub',
  P2P_FORM = 'P2P_FORM',
  ACCOUNT_P2P_FORM = 'ACCOUNT_P2P_FORM',
  P2P_CARD = 'P2P_CARD',
  P2P_BILL = 'P2P_BILL',
  P2P_SBP = 'P2P_SBP',
  ONE = '1',
  TWO = '2',
  PAYSCROW_SBP = '2ec6dbd6-49a5-45d0-bd6d-b0134ee4639a',
  PAYSCROW_CARD = '8fe3669a-a448-4053-bc4b-43bb51cb3e9d',
  CARD_RU_RAND_SBP = 'card_ru_rand_sbp',
  CARD_RU_RAND_CARD = 'card_ru_rand_card',
  SBP_RU_RAND = 'sbp_ru_rand',
  MONEYRUB_GTLIMIT = 'MoneyRUB_Gtlimit',
  FIAT = 'fiat',
  CRYPTO = 'crypto',
  PC = 'PC',
  AC = 'AC',
  FREEKASSA = 'freekasa',
  YUMANI = 'PC',
  CRYPTOBOT = 'cryptobot',
  USDT20 = 'USDT20',
}

export enum MethodNameEnum {
  SBP = 'SBP',
  CARD = 'CARD',
  WALLET = 'WALLET',
  CRYPTO = 'CRYPTO',
  PLATEGA = 'PLATEGA',
  OPS = 'OPS',
}

@Entity({ tableName: 'financeProviderMethods' })
export class FinanceProviderMethods extends BaseEntity {
  @Enum(() => MethodNameEnum)
  name: MethodNameEnum;

  @Enum(() => MethodEnum)
  value: MethodEnum;

  @ManyToOne(() => FinanceProviderSettings)
  providerSettings: FinanceProviderSettings;

  @OneToMany(() => FinanceProviderSubMethods, (sm) => sm.method)
  subMethods = new Collection<FinanceProviderSubMethods>(this);

  @OneToOne(() => PaymentMethodImage, (image) => image.method, {
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
  })
  image?: PaymentMethodImage;
}
