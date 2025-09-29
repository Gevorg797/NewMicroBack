import { Module } from "@nestjs/common";
import { FreekassaController } from "./freekassa.controller";
import { FreekassaService } from "./freekassa.service";
import { ConfigModule } from "@nestjs/config";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Currency, FinanceProviderSettings, FinanceTransactions } from "@lib/database";

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MikroOrmModule.forFeature([
            FinanceProviderSettings,
            Currency,
            FinanceTransactions
        ])
    ],
    controllers: [FreekassaController],
    providers: [FreekassaService],
    exports: []
})

export class FreekassaModule { }