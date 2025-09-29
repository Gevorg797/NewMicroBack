import { Injectable, NotFoundException } from "@nestjs/common";
import { CreatePayinOrderDto } from "./dto/create-payin-order.dto";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Currency, FinanceProviderSettings, FinanceTransactions } from "@lib/database";
import * as crypto from "crypto";
import axios from "axios";
import { InjectRepository } from "@mikro-orm/nestjs";
import { PaymentTransactionStatus } from "@lib/database/entities/finance-provider-transactions.entity";

@Injectable()
export class FreekassaService {
    constructor(
        @InjectRepository(FinanceProviderSettings)
        readonly fiananceProviderSettingsRepository: EntityRepository<FinanceProviderSettings>,
        @InjectRepository(Currency)
        readonly currencyRepository: EntityRepository<Currency>,
        @InjectRepository(FinanceTransactions)
        readonly financeTransactionRepo: EntityRepository<FinanceTransactions>
    ) { }

    async createPayinOrder(body: CreatePayinOrderDto) {
        const { transactionId, amount, currencyId, providerSettingsId } = body

        const currency = await this.currencyRepository.findOne({ id: currencyId })

        if (!currency) {
            throw new Error('Currency not found')
        }

        const provider = await this.fiananceProviderSettingsRepository.findOne({ id: providerSettingsId })

        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        const shopId = (provider.shopId as number).toString()
        const orderId = transactionId.toString();
        const orderAmount = amount.toString();
        const currencyCode = currency.name;
        const secretWord = provider.publicKey as string;

        const sign = this.generateFormSignature(
            shopId,
            orderAmount,
            secretWord,
            currencyCode,
            orderId,
        );


        const url = `${provider.paymentFormLink}?m=${shopId}&oa=${orderAmount}&o=${orderId}&s=${sign}&currency=${currencyCode}`;

        return { url }
    }


    private generateSignature(data: any, key: string) {
        const sortedKeys = Object.keys(data).sort();

        const sortedValues = sortedKeys.map(key => data[key]);

        const signString = sortedValues.join("|");

        return crypto.createHmac("sha256", key).update(signString).digest("hex");
    }


    private generateFormSignature(
        shopId: string,
        amount: string,
        secret: string,
        currency: string,
        orderId: string,
    ): string {
        const signString = `${shopId}:${amount}:${secret}:${currency}:${orderId}`;
        return crypto.createHash("md5").update(signString).digest("hex");
    }

    async handleCallback(body: any, ipAddress: string) {
        const { MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, SIGN, intid } = body;

        console.log(ipAddress, 'ipAddress');

        const allowedIps = [
            "168.119.157.136",
            "168.119.60.227",
            "178.154.197.79",
            "51.250.54.238",
        ];

        if (ipAddress && !allowedIps.includes(ipAddress)) {
            throw new Error("hacking attempt!");
        }

        const transaction = await this.financeTransactionRepo.findOne({ id: Number(MERCHANT_ORDER_ID) }, {
            populate: [
                'method',
                'method.providerSettings',
                'user',
                'user.balance',
                'currency'
            ],
        })

        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }

        if (transaction.status === PaymentTransactionStatus.COMPLETED ||
            transaction.status === PaymentTransactionStatus.FAILED) {
            throw new NotFoundException('Transaction already processed, return early');
        }

        if (transaction.amount !== parseFloat(AMOUNT)) {
            throw new Error('Amount mismatch');
        }

        const generateSign = this.generateFormSignature(
            MERCHANT_ID,
            AMOUNT,
            transaction.method.providerSettings.publicKey as string,
            transaction.currency.name,
            (transaction.id as number).toString()
        )

        if (generateSign.toUpperCase() !== SIGN.toUpperCase()) {
            throw new Error("wrong sign");
        }

        transaction.status = PaymentTransactionStatus.COMPLETED;

        transaction.paymentTransactionId = intid || null;

        if (!transaction.user.balance) {
            throw new Error('Balance not found for user');
        }

        transaction.user.balance.balance += AMOUNT

        await this.financeTransactionRepo.getEntityManager().persistAndFlush([
            transaction,
            transaction.user.balance,
        ]);

        return 'YES'
    }
}