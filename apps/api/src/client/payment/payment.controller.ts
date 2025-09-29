import { Body, Controller, Post } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { CreatePayinProcessDto } from "./dto/create-payin-process.dto";
import { CreatePayoutProcessDto } from "./dto/create-payout-process.dto";

@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService
    ) { }

    @Post('payin')
    async payin(@Body() body: CreatePayinProcessDto) {
        return this.paymentService.payin(body)
    }


    @Post('payout')
    async payout(@Body() body: CreatePayoutProcessDto) {
        return this.paymentService.payout(body)
    }
}