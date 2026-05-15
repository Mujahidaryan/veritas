import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@veritas/shared-types';

class UpdateSettingsDto {
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsBoolean() mfaRequired?: boolean;
  @IsOptional() @IsString() verificationDomain?: string;
}

class CreateDepartmentDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/org')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get()
  @Roles('viewer')
  @ApiOperation({ summary: 'Get current tenant details' })
  get(@CurrentUser() user: JwtPayload) {
    return this.tenants.getTenant(user.tenantId);
  }

  @Put('settings')
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Update tenant settings' })
  updateSettings(@Body() dto: UpdateSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.tenants.updateTenantSettings(user.tenantId, dto);
  }

  @Get('departments')
  @Roles('viewer')
  @ApiOperation({ summary: 'List departments' })
  getDepartments(@CurrentUser() user: JwtPayload) {
    return this.tenants.getDepartments(user.tenantId);
  }

  @Post('departments')
  @Roles('enterprise_admin', 'department_admin')
  @ApiOperation({ summary: 'Create department' })
  createDepartment(@Body() dto: CreateDepartmentDto, @CurrentUser() user: JwtPayload) {
    return this.tenants.createDepartment(user.tenantId, dto.name, dto.description);
  }
}
