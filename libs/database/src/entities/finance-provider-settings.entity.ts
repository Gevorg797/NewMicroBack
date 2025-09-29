import { Collection, Entity, ManyToOne, OneToMany, Property } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import { FinanceProvider } from "./finance-provider.entity";
import { Site } from "./site.entity";
import { FinanceProviderMethods } from "./finance-provider-methods.entity";

@Entity({ tableName: 'financeProviderSettings' })
export class FinanceProviderSettings extends BaseEntity {
    @ManyToOne(() => FinanceProvider)
    provider!: FinanceProvider;

    @ManyToOne(() => Site)
    site!: Site

    @Property({ nullable: true })
    shopId?: number;

    @Property({ length: 100, nullable: true })
    publicKey?: string

    @Property({ length: 100, nullable: true })
    privateKey?: string

    @Property({ length: 100, nullable: true })
    apiKey?: string

    @Property({ length: 200, nullable: true })
    baseURL!: string;

    @Property({ length: 200, nullable: true })
    paymentFormLink?: string

    @Property({ length: 200, nullable: true })
    callbackUrl?: string;

    @Property({ nullable: false, type: 'float', default: 0 })
    percentage: number;

    @OneToMany(() => FinanceProviderMethods, m => m.providerSettings)
    methods = new Collection<FinanceProviderMethods>(this)
}