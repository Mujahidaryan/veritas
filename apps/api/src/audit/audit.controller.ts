import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '@veritas/shared-types';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get('logs')
  @Roles('enterprise_admin', 'department_admin')
  @ApiOperation({ summary: 'Get paginated audit logs' })
  async getLogs(
    @CurrentUser() user: JwtPayload,
    @Query('eventType') eventType?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.audit.getLogs(user.tenantId, {
      eventType: eventType as never,
      actorId,
      resourceId,
      from,
      to,
      page: +page,
      limit: +limit,
    });
  }

  @Get('chain-integrity')
  @Roles('enterprise_admin')
  @ApiOperation({ summary: 'Verify audit chain integrity' })
  async verifyChain(@CurrentUser() user: JwtPayload) {
    return this.audit.verifyChainIntegrity(user.tenantId);
  }
}
