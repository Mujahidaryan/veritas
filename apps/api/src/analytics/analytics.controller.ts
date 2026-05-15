import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@veritas/shared-types';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('summary')
  @Roles('enterprise_admin', 'department_admin')
  @ApiOperation({ summary: 'Get analytics summary for tenant' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.analytics.getSummary(user.tenantId);
  }
}
