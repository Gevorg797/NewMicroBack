import { Controller } from '@nestjs/common';
import { SuperomaticService } from './superomatic.service';

@Controller('superomatic')
export class SuperomaticController {
    constructor(private readonly superomaticService: SuperomaticService) { }
}