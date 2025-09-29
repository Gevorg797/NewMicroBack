import { Currency, FinanceTransactions } from "@lib/database";
import { PaymentTransactionStatus } from "@lib/database/entities/finance-provider-transactions.entity";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import axios from "axios";
import { createHash, createHmac } from "crypto";

@Injectable()
export class CryptobotService {
    constructor(
        @InjectRepository(Currency)
        readonly currencyRepository: EntityRepository<Currency>,
        @InjectRepository(FinanceTransactions)
        readonly financeTransactionsRepo: EntityRepository<FinanceTransactions>,

    ) { }

    async createPayinOrder(body: any) {
        const { currencyId, transactionId, amount } = body

        const currency = await this.currencyRepository.findOne({ id: currencyId })

        if (!currency) {
            throw new Error('Currency not found')
        }

        const transaction = await this.financeTransactionsRepo.findOne({ id: transactionId }, {
            populate: [
                'method',
                'method.providerSettings',
            ],
        })

        let reqBody: any = {
            amount,
        }

        let availableСurrencies: any

        if (transaction?.method.name === 'fiat') {
            availableСurrencies = ['USD', 'EUR', 'RUB', 'BYN', 'UAH', 'GBP', 'CNY', 'KZT', 'UZS', 'GEL', 'TRY', 'AMD', 'THB', 'INR', 'BRL', 'IDR', 'AZN', 'AED', 'PLN', 'ILS']

            if (!availableСurrencies.includes(currency.name)) {
                throw new NotFoundException(`Currency ${currency.name} is not supported in method ${transaction?.method.name}`);
            }

            reqBody.fiat = currency.name
        } else if (transaction?.method.name === 'crypto') {
            availableСurrencies = ['USDT', 'TON', 'BTC', 'ETH', 'LTC', 'BNB', 'TRX', 'USDC']

            if (!availableСurrencies.includes(currency.name)) {
                throw new NotFoundException(`Currency ${currency.name} is not supported in method ${transaction?.method.name}`);
            }

            reqBody.asset = currency.name
        }

        try {
            const response = await axios.post(`${(transaction?.method.providerSettings.baseURL as string)}createInvoice`, reqBody, {
                headers: {
                    'Crypto-Pay-API-Token': transaction?.method.providerSettings.apiKey
                },
            })



            return response.data
        } catch (error) {
            const providerMessage = error.response?.data?.message || error.message;
            throw new NotFoundException(`Cryptobot request failed: ${providerMessage}`);
        }
    }

    async createPayoutProcess(body: any) {
        const { transactionId, amount, currencyId } = body

        const currency = await this.currencyRepository.findOne({ id: currencyId })

        if (!currency) {
            throw new NotFoundException('Currency not found')
        }

        const transaction = await this.financeTransactionsRepo.findOne({ id: transactionId }, {
            populate: [
                'method',
                'method.providerSettings',
                'user'
            ],
        })

        if (!transaction) {
            throw new NotFoundException('transaction not found')
        }

        const reqBody = {
            user_id: transaction?.user.telegramId,
            asset: currency.name,
            amount,
            spend_id: transaction.id
        }


        try {
            const response = await axios.post(`
                ${(transaction?.method.providerSettings.baseURL as string)}transfer`,
                reqBody, {
                headers: {
                    'Crypto-Pay-API-Token': transaction?.method.providerSettings.apiKey
                },
            })

            transaction.paymentTransactionId = response.data.invoice_id
            await this.financeTransactionsRepo.getEntityManager().persistAndFlush(transaction);



            return response.data
        } catch (error) {
            console.log(error.response.data.error);

            const providerMessage = error.response.data.error.name || error.message;
            throw new NotFoundException(`Cryptobot request failed: ${providerMessage}`);
        }
    }

    async handleCallback(body: any, headers: any) {
        const { payload } = body


        const transaction = await this.financeTransactionsRepo.findOne({ paymentTransactionId: payload.invoice_id }, {
            populate: [
                'method',
                'method.providerSettings',
            ],
        })

        if (!transaction) {
            throw new NotFoundException('transaction not found');
        }

        if (!this.checkSignature(transaction.method.providerSettings.apiKey as string, payload, headers)) {
            throw new BadRequestException('hack attempt')
        }


        if (transaction.status === PaymentTransactionStatus.COMPLETED ||
            transaction.status === PaymentTransactionStatus.FAILED) {
            throw new NotFoundException('Transaction already processed, return early');
        }

        if (transaction.amount !== parseFloat(payload.amount)) {
            throw new Error('Amount mismatch');
        }

        if (!transaction.user.balance) {
            throw new Error('Balance not found for user');
        }

        transaction.user.balance.balance += payload.amount

        await this.financeTransactionsRepo.getEntityManager().persistAndFlush([
            transaction,
            transaction.user.balance,
        ]);
    }

    private checkSignature(token: string, body: any, headers: any) {
        const secret = createHash('sha256').update(token).digest();
        const checkString = JSON.stringify(body);
        const hmac = createHmac('sha256', secret).update(checkString).digest('hex');
        return hmac === headers['crypto-pay-api-signature'];
    }

}