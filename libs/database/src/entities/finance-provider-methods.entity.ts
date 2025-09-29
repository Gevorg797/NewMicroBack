import { Collection, Entity, Enum, ManyToOne, OneToMany, Property } from "@mikro-orm/core";
import { FinanceProviderSettings } from "./finance-provider-settings.entity";
import { BaseEntity } from "./base.entity";
import { FinanceTransactions } from "./finance-provider-transactions.entity";

export enum MethodTypeEnum {
    PAYIN = 'Payin',
    PAYOUT = 'Payout',
}

@Entity({ tableName: 'financeProviderMethods' })
export class FinanceProviderMethods extends BaseEntity {
    @Property({ length: 100 })
    name!: string

    @Enum(() => MethodTypeEnum)
    type!: MethodTypeEnum;

    @Property({ default: 0, nullable: true })
    minAmount: number

    @Property({ default: 0, nullable: true })
    maxAmount: number

    @Property({ default: true })
    isEnabled!: boolean

    @Property({ default: false, nullable: true })
    isFavorite?: boolean

    @ManyToOne(() => FinanceProviderSettings)
    providerSettings: FinanceProviderSettings

    @OneToMany(() => FinanceTransactions, t => t.method)
    transactions = new Collection<FinanceTransactions>(this);
}