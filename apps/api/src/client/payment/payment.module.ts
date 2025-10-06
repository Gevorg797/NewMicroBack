import { Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { ConfigModule } from "@nestjs/config";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { FinanceProviderSettings, FinanceTransactions, User } from "@lib/database";
import { MsFinanceModule } from "libs/microservices-clients/ms-finance/ms-finance.module";
import { FinanceProviderSubMethods } from "@lib/database/entities/finance-provider-sub-method.entity";

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MikroOrmModule.forFeature([
            FinanceProviderSubMethods,
            FinanceProviderSettings,
            FinanceTransactions,
            User
        ]),
        MsFinanceModule
    ],
    controllers: [PaymentController],
    providers: [PaymentService],
    exports: []
})

export class PaymentModule { }