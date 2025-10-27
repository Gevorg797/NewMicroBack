import {
    Entity,
    ManyToOne,
    Property,
    Enum,
    Unique,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Promocode } from './promocode.entity';
import { Balances } from './balances.entity';

export enum PromocodeUsageStatus {
    PENDING = 'pending',
    APPLIED = 'applied',
    FAILED = 'failed',
}

@Entity({ tableName: 'promocode_usage' })
@Unique({ properties: ['user', 'promocode'] })
export class PromocodeUsage extends BaseEntity {
    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Promocode)
    promocode!: Promocode;

    @Property({ columnType: 'timestamptz', defaultRaw: 'NOW()' })
    usedAt: Date = new Date();

    @Enum(() => PromocodeUsageStatus)
    @Property({ default: PromocodeUsageStatus.APPLIED })
    status: PromocodeUsageStatus = PromocodeUsageStatus.APPLIED;

    @Property({ columnType: 'double precision', nullable: true })
    bonusAmount?: number; // The actual bonus amount that was given

    @ManyToOne(() => Balances, { nullable: true })
    targetBalance?: Balances; // Which balance received the bonus

    @Property({ columnType: 'text', nullable: true })
    notes?: string; // Any additional notes about this usage

    @Property({ columnType: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
