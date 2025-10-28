import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WheelService } from './wheel.service';
import { WheelSpinDto, WheelSpinResponseDto } from './dto/wheel-spin.dto';

@ApiTags('wheel')
@ApiBearerAuth()
@Controller('wheel')
export class WheelController {
    constructor(private readonly wheelService: WheelService) { }

    @Post('spin')
    @ApiOperation({ summary: 'Spin the reward wheel' })
    @ApiBody({ type: WheelSpinDto })
    @ApiResponse({ status: 201, type: WheelSpinResponseDto })
    spin(@Body() dto: WheelSpinDto) {
        return this.wheelService.spin(dto.recoilType);
    }
}


