import {
  Controller, Get, Post, Param, UploadedFile,
  UseInterceptors, Ip, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { DocumentsService } from '../documents/documents.service';
import { Public } from '../auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Public Verification')
@Controller('pub')
export class VerificationController {
  constructor(private docs: DocumentsService) {}

  /**
   * QR scan verification — public, no account required.
   * Rate-limited to 50 req/min per IP to prevent abuse.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 50 } })
  @Get('verify/:tenantSlug/:documentId/:token')
  @ApiOperation({ summary: 'Verify document via QR token (public)' })
  async verifyByQr(
    @Param('tenantSlug') tenantSlug: string,
    @Param('documentId') documentId: string,
    @Param('token') token: string,
    @Ip() ip: string,
  ) {
    return this.docs.verifyByQrToken(tenantSlug, documentId, token, ip);
  }

  /**
   * File upload verification — public drag-and-drop portal.
   * Tenant slug required to scope the search.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('verify/:tenantSlug/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify document by file upload (public)' })
  async verifyByUpload(
    @Param('tenantSlug') tenantSlug: string,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    const { PrismaService } = await import('../prisma/prisma.service');
    // Resolve tenant from slug — re-use docs service
    return this.docs.verifyByFile(file, tenantSlug, ip);
  }
}
