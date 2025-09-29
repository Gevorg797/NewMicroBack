import { Collection, Entity, OneToMany, Property } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import { FinanceProviderSettings } from "./finance-provider-settings.entity";

@Entity({ tableName: 'financeProvider' })
export class FinanceProvider extends BaseEntity {
    @Property({ length: 250 })
    name!: string

    @OneToMany(() => FinanceProviderSettings, s => s.provider)
    settings = new Collection<FinanceProviderSettings>(this);

    @Property({ columnType: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @Property({ default: true })
    isEnabled: boolean = true
}