import {
  Controller, Get, Post, Delete, Body, Param,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsUrl } from 'class-validator';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@veritas/shared-types';

class CreateWebhookDto {
  @IsUrl()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Post()
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  create(@Body() dto: CreateWebhookDto, @CurrentUser() user: JwtPayload) {
    return this.webhooks.createWebhook(user.tenantId, dto.url, dto.events);
  }

  @Get()
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'List webhook configurations' })
  list(@CurrentUser() user: JwtPayload) {
    return this.webhooks.listWebhooks(user.tenantId);
  }

  @Delete(':id')
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Delete a webhook' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.webhooks.deleteWebhook(id, user.tenantId);
  }
}
