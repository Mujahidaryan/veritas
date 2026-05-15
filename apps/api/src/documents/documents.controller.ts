import {
  Controller, Post, Get, Put, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile,
  ParseUUIDPipe, HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IssueDocumentDto } from './dto/issue-document.dto';
import { RevokeDocumentDto } from './dto/revoke-document.dto';
import { JwtPayload } from '@veritas/shared-types';

const FILE_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
};

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/documents')
export class DocumentsController {
  constructor(private docs: DocumentsService) {}

  @Post('issue')
  @Roles('issuer', 'department_admin', 'enterprise_admin')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Issue a document and anchor its proof on-chain' })
  async issue(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: IssueDocumentDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.docs.issueDocument(file, {
      departmentId: dto.departmentId,
      metadata: {
        type: dto.type as never,
        title: dto.title,
        issuedTo: dto.issuedTo,
        tags: dto.tags,
        customFields: dto.customFields,
      },
      expiresAt: dto.expiresAt,
    }, user, ip);
  }

  @Post('verify')
  @Roles('verifier', 'issuer', 'department_admin', 'enterprise_admin')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Verify a document by uploading the file' })
  @HttpCode(HttpStatus.OK)
  async verifyByFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.docs.verifyByFile(file, user.tenantId, ip);
  }

  @Get()
  @Roles('viewer')
  @ApiOperation({ summary: 'List documents for tenant' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('departmentId') departmentId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.docs.listDocuments(user.tenantId, departmentId, +page, +limit);
  }

  @Get(':id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Get document by ID' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.docs.getDocument(id, user.tenantId);
  }

  @Get(':id/qr')
  @Roles('viewer')
  @ApiOperation({ summary: 'Get QR code data URL for a document' })
  async getQr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const qrDataUrl = await this.docs.generateQrCode(id, user.tenantId);
    return { qrDataUrl };
  }

  @Put(':id/revoke')
  @Roles('issuer', 'department_admin', 'enterprise_admin')
  @ApiOperation({ summary: 'Revoke a document' })
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeDocumentDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.docs.revokeDocument(id, dto.reason, user, ip);
  }
}
