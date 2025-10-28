import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { PromocodesService } from './promocodes.service';
import { ApplyPromocodeDto } from './dto/apply-promocode.dto';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Add your auth guard

@Controller('promocodes')
// @UseGuards(JwtAuthGuard) // Protect endpoints with authentication
export class PromocodesController {
    constructor(private readonly promocodesService: PromocodesService) { }

    @Post()
    create(@Body() createPromocodeDto: CreatePromocodeDto) {
        return this.promocodesService.create(createPromocodeDto);
    }

    @Get('validate/:code')
    validatePromocode(@Param('code') code: string) {
        return this.promocodesService.findByCode(code);
    }

    // @Post('apply/:userId')
    // applyPromocode(
    //     @Param('userId', ParseIntPipe) userId: number,
    //     @Body() applyDto: ApplyPromocodeDto,
    // ) {
    //     return this.promocodesService.applyPromocode(userId, applyDto);
    // }

    @Get('history/:userId')
    getUserHistory(@Param('userId', ParseIntPipe) userId: number) {
        return this.promocodesService.getUserPromocodeHistory(userId);
    }
}
