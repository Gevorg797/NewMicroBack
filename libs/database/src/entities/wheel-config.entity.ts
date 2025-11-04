import { Entity, Property, Enum } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';

export enum WheelGivingType {
  SUPER = 'super',
  GOOD = 'good',
  NORMAL = 'normal',
  BAD = 'bad',
}

@Entity({ tableName: 'wheelConfig' })
export class WheelConfig extends BaseEntity {
  @Property({ columnType: 'numeric(10,2)', default: '0' })
  wheelLimit: string = '0'; // Bank amount

  @Property({ columnType: 'numeric(10,2)', default: '0' })
  wheelEnoughSum: string = '0'; // Minimum bet sum needed to unlock wheel

  @Enum(() => WheelGivingType)
  wheelRecoil: WheelGivingType = WheelGivingType.NORMAL;
}
