import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FinancesService } from './finances.service';
import { CreateProviderSettingsDto } from './dto/create-provider-settings.dto';
import { UpdateProviderSettingsDto } from './dto/update-provider-settings.dto';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderMethodDto } from './dto/create-provider-method.dto';
import { UpdateProviderMethodDto } from './dto/update-provider-method.dto';
import { CreateSubMethodDto } from './dto/create-sub-method.dto';
import { UpdateSubMethodDto } from './dto/update-sub-method.dto';
import { ApiPaginated, PaginateQuery } from 'libs/utils/pagination';
import {
  FinanceProviderSettings,
  FinanceProvider,
  FinanceProviderMethods,
  FinanceProviderSubMethods,
} from '@lib/database';

@ApiTags('Finances Management')
@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  // ==================== Providers ====================

  @Get('providers')
  @ApiOperation({ summary: 'Get all providers with pagination' })
  @ApiPaginated(FinanceProvider)
  async getProviders(@Query() query: PaginateQuery) {
    return this.financesService.getProviders(query);
  }

  @Get('providers/active')
  @ApiOperation({ summary: 'Get all active providers' })
  @ApiResponse({ status: 200, description: 'Active providers retrieved' })
  async getActiveProviders() {
    return this.financesService.getActiveProviders();
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Get provider by ID' })
  @ApiResponse({ status: 200, description: 'Provider found' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getProviderById(@Param('id') id: number) {
    return this.financesService.getProviderById(id);
  }

  @Post('providers')
  @ApiOperation({ summary: 'Create new provider' })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createProvider(@Body() data: CreateProviderDto) {
    return this.financesService.createProvider(data);
  }

  @Put('providers/:id')
  @ApiOperation({ summary: 'Update provider' })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async updateProvider(
    @Param('id') id: number,
    @Body() data: UpdateProviderDto,
  ) {
    return this.financesService.updateProvider(id, data);
  }

  // ==================== Provider Settings ====================

  @Get('provider-settings')
  @ApiOperation({ summary: 'Get all provider settings with pagination' })
  @ApiPaginated(FinanceProviderSettings)
  async getProviderSettings(@Query() query: PaginateQuery) {
    return this.financesService.getProviderSettings(query);
  }

  @Get('provider-settings/:id')
  @ApiOperation({ summary: 'Get provider settings by ID' })
  @ApiResponse({ status: 200, description: 'Provider settings found' })
  @ApiResponse({ status: 404, description: 'Provider settings not found' })
  async getProviderSettingsById(@Param('id') id: number) {
    return this.financesService.getProviderSettingsById(id);
  }

  @Post('provider-settings')
  @ApiOperation({ summary: 'Create new provider settings' })
  @ApiResponse({
    status: 201,
    description: 'Provider settings created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Provider or Site not found' })
  async createProviderSettings(@Body() data: CreateProviderSettingsDto) {
    return this.financesService.createProviderSettings(data);
  }

  @Put('provider-settings/:id')
  @ApiOperation({ summary: 'Update provider settings' })
  @ApiResponse({
    status: 200,
    description: 'Provider settings updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Provider settings not found' })
  async updateProviderSettings(
    @Param('id') id: number,
    @Body() data: UpdateProviderSettingsDto,
  ) {
    return this.financesService.updateProviderSettings(id, data);
  }

  @Get('sites/:siteId/provider-settings')
  @ApiOperation({ summary: 'Get provider settings for a specific site' })
  @ApiResponse({ status: 200, description: 'Provider settings retrieved' })
  async getProviderSettingsBySite(@Param('siteId') siteId: number) {
    return this.financesService.getProviderSettingsBySite(siteId);
  }

  // ==================== Provider Methods ====================

  @Get('provider-methods')
  @ApiOperation({ summary: 'Get all provider methods with pagination' })
  @ApiPaginated(FinanceProviderMethods)
  async getProviderMethods(@Query() query: PaginateQuery) {
    return this.financesService.getProviderMethods(query);
  }

  @Get('provider-methods/:id')
  @ApiOperation({ summary: 'Get provider method by ID' })
  @ApiResponse({ status: 200, description: 'Provider method found' })
  @ApiResponse({ status: 404, description: 'Provider method not found' })
  async getProviderMethodById(@Param('id') id: number) {
    return this.financesService.getProviderMethodById(id);
  }

  @Post('provider-methods')
  @ApiOperation({ summary: 'Create new provider method' })
  @ApiResponse({
    status: 201,
    description: 'Provider method created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({
    status: 404,
    description: 'Provider settings not found',
  })
  async createProviderMethod(@Body() data: CreateProviderMethodDto) {
    return this.financesService.createProviderMethod(data);
  }

  @Put('provider-methods/:id')
  @ApiOperation({ summary: 'Update provider method' })
  @ApiResponse({
    status: 200,
    description: 'Provider method updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Provider method not found' })
  async updateProviderMethod(
    @Param('id') id: number,
    @Body() data: UpdateProviderMethodDto,
  ) {
    return this.financesService.updateProviderMethod(id, data);
  }

  @Get('provider-settings/:settingsId/methods')
  @ApiOperation({ summary: 'Get methods for a specific provider settings' })
  @ApiResponse({ status: 200, description: 'Provider methods retrieved' })
  async getProviderMethodsBySettings(@Param('settingsId') settingsId: number) {
    return this.financesService.getProviderMethodsBySettings(settingsId);
  }

  // ==================== Sub Methods ====================

  @Get('sub-methods')
  @ApiOperation({ summary: 'Get all sub methods with pagination' })
  @ApiPaginated(FinanceProviderSubMethods)
  async getSubMethods(@Query() query: PaginateQuery) {
    return this.financesService.getSubMethods(query);
  }

  @Get('sub-methods/:id')
  @ApiOperation({ summary: 'Get sub method by ID' })
  @ApiResponse({ status: 200, description: 'Sub method found' })
  @ApiResponse({ status: 404, description: 'Sub method not found' })
  async getSubMethodById(@Param('id') id: number) {
    return this.financesService.getSubMethodById(id);
  }

  @Post('sub-methods')
  @ApiOperation({ summary: 'Create new sub method' })
  @ApiResponse({ status: 201, description: 'Sub method created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Method not found' })
  async createSubMethod(@Body() data: CreateSubMethodDto) {
    return this.financesService.createSubMethod(data);
  }

  @Put('sub-methods/:id')
  @ApiOperation({ summary: 'Update sub method' })
  @ApiResponse({ status: 200, description: 'Sub method updated successfully' })
  @ApiResponse({ status: 404, description: 'Sub method not found' })
  async updateSubMethod(
    @Param('id') id: number,
    @Body() data: UpdateSubMethodDto,
  ) {
    return this.financesService.updateSubMethod(id, data);
  }

  @Get('provider-methods/:methodId/sub-methods')
  @ApiOperation({ summary: 'Get sub methods for a specific provider method' })
  @ApiResponse({ status: 200, description: 'Sub methods retrieved' })
  async getSubMethodsByMethod(@Param('methodId') methodId: number) {
    return this.financesService.getSubMethodsByMethod(methodId);
  }
}
