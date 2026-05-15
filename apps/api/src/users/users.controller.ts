import {
  Controller, Get, Post, Put, Delete, Body,
  Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@veritas/shared-types';

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() role: string;
  @IsOptional() @IsString() departmentId?: string;
}

class UpdateRoleDto {
  @IsEnum(['enterprise_admin', 'department_admin', 'issuer', 'verifier', 'viewer'])
  role: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/org/users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  @Roles('enterprise_admin', 'department_admin')
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.users.createUser(user.tenantId, dto);
  }

  @Get()
  @Roles('enterprise_admin', 'department_admin')
  @ApiOperation({ summary: 'List users' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.users.listUsers(user.tenantId, +page, +limit);
  }

  @Put(':id/role')
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Update user role' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.updateUserRole(id, user.tenantId, dto.role);
  }

  @Delete(':id')
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Deactivate user' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.deactivateUser(id, user.tenantId);
  }
}
