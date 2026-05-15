import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { BlockchainClient } from '@veritas/blockchain-client';
import hashingEngine from '@veritas/hashing-engine';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload, IssueDocumentRequest, VerifyDocumentResponse } from '@veritas/shared-types';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
    private config: ConfigService,
    private blockchain: BlockchainClient,
    @InjectQueue('documents') private documentsQueue: Queue,
  ) {}

  async issueDocument(
    file: Express.Multer.File,
    dto: IssueDocumentRequest,
    actor: JwtPayload,
    ipAddress: string,
  ) {
    // Validate department belongs to tenant
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId: actor.tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');

    // Check monthly quota
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
    });
    if (tenant.documentsUsedThisMonth >= tenant.maxDocumentsPerMonth) {
      throw new ForbiddenException('Monthly document quota exceeded. Please upgrade your plan.');
    }

    // Hash the file
    const hashResult = await hashingEngine.hashBuffer(
      file.buffer,
      file.mimetype,
      { tenantSalt: tenant.id },
    );

    // Duplicate check
    const existing = await this.prisma.document.findFirst({
      where: { hashSha256: hashResult.sha256, tenantId: actor.tenantId },
    });
    if (existing) {
      throw new BadRequestException(
        `Document already issued. Existing ID: ${existing.id}`
      );
    }

    // Hash metadata deterministically
    const metadataHash = hashingEngine.hashMetadata(dto.metadata as Record<string, unknown>);

    // Generate document ID and QR token
    const documentId = uuidv4();
    const qrSecret = this.config.get<string>('qr.secret')!;
    const qrToken = hashingEngine.generateQrToken(documentId, actor.tenantId, qrSecret);
    const baseUrl = this.config.get<string>('qr.verificationBaseUrl')!;
    const qrUrl = `${baseUrl}/verify/${tenant.slug}/${documentId}/${qrToken}`;

    // Anchor on blockchain (async — non-blocking for UX)
    const blockchainProof = await this.blockchain.anchorDocument({
      documentId,
      tenantId: actor.tenantId,
      hashSha256: hashResult.sha256,
      metadataHash,
      issuedAt: new Date().toISOString(),
    });

    // Save to database
    const document = await this.prisma.document.create({
      data: {
        id: documentId,
        tenantId: actor.tenantId,
        departmentId: dto.departmentId,
        issuerId: actor.sub,
        hashSha256: hashResult.sha256,
        metadataHash,
        documentType: dto.metadata.type,
        title: dto.metadata.title,
        issuedTo: dto.metadata.issuedTo,
        tags: dto.metadata.tags ?? [],
        customFields: dto.metadata.customFields,
        blockchainTxId: blockchainProof.txId,
        blockchainBlock: blockchainProof.blockNumber,
        qrToken,
        qrUrl,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // Update usage counter
    await this.prisma.tenant.update({
      where: { id: actor.tenantId },
      data: { documentsUsedThisMonth: { increment: 1 } },
    });

    // Queue: upload original file to encrypted cloud storage
    await this.documentsQueue.add('store-file', {
      documentId,
      tenantId: actor.tenantId,
      buffer: file.buffer.toString('base64'),
      mimetype: file.mimetype,
      originalName: file.originalname,
    });

    // Audit trail
    await this.audit.log({
      tenantId: actor.tenantId,
      actorId: actor.sub,
      eventType: 'document.issued',
      resourceId: documentId,
      ipAddress,
      payload: {
        documentType: dto.metadata.type,
        departmentId: dto.departmentId,
        hashSha256: hashResult.sha256,
        blockchainTxId: blockchainProof.txId,
      },
    });

    this.logger.log(`Document issued: ${documentId} by ${actor.sub}`);

    return { ...document, blockchainProof };
  }

  async verifyByFile(
    file: Express.Multer.File,
    tenantId: string,
    ipAddress: string,
  ): Promise<VerifyDocumentResponse> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const hashResult = await hashingEngine.hashBuffer(
      file.buffer,
      file.mimetype,
      { tenantSalt: tenantId },
    );

    const document = await this.prisma.document.findFirst({
      where: { hashSha256: hashResult.sha256, tenantId },
      include: {
        issuer: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
        tenant: { select: { name: true, logoUrl: true } },
      },
    });

    const verifiedAt = new Date().toISOString();

    // Audit regardless of outcome
    await this.audit.log({
      tenantId,
      eventType: document ? 'verification.success' : 'verification.failed',
      resourceId: document?.id,
      ipAddress,
      payload: { hashSha256: hashResult.sha256 },
    });

    if (!document) {
      return { status: 'not_found', verifiedAt };
    }

    if (document.status === 'REVOKED') {
      return {
        status: 'revoked',
        document: this.mapDocumentToPublic(document),
        verifiedAt,
      };
    }

    if (document.expiresAt && document.expiresAt < new Date()) {
      return {
        status: 'expired',
        document: this.mapDocumentToPublic(document),
        verifiedAt,
      };
    }

    // Update scan counter
    await this.prisma.document.update({
      where: { id: document.id },
      data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
    });

    return {
      status: 'authentic',
      document: this.mapDocumentToPublic(document),
      issuer: {
        name: `${document.issuer.firstName} ${document.issuer.lastName}`,
        department: document.department.name,
        organization: document.tenant.name,
        logoUrl: document.tenant.logoUrl ?? undefined,
      },
      blockchainProof: {
        txId: document.blockchainTxId ?? '',
        blockNumber: document.blockchainBlock ?? 0,
        channelId: 'veritas-channel',
        chaincodeName: 'document-registry',
        timestamp: document.createdAt.toISOString(),
        endorsers: ['VeritasMSP'],
        hashOnChain: hashResult.sha256,
      },
      verifiedAt,
    };
  }

  async verifyByQrToken(
    tenantSlug: string,
    documentId: string,
    qrToken: string,
    ipAddress: string,
  ): Promise<VerifyDocumentResponse> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { status: 'not_found', verifiedAt: new Date().toISOString() };

    const qrSecret = this.config.get<string>('qr.secret')!;
    const tokenValid = hashingEngine.verifyQrToken(qrToken, documentId, tenant.id, qrSecret);

    if (!tokenValid) {
      await this.audit.log({
        tenantId: tenant.id,
        eventType: 'verification.tampered',
        resourceId: documentId,
        ipAddress,
        payload: { reason: 'invalid_qr_token' },
      });
      return { status: 'tampered', verifiedAt: new Date().toISOString() };
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId: tenant.id },
      include: {
        issuer: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
        tenant: { select: { name: true, logoUrl: true } },
      },
    });

    if (!document) return { status: 'not_found', verifiedAt: new Date().toISOString() };

    await this.prisma.document.update({
      where: { id: document.id },
      data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
    });

    await this.audit.log({
      tenantId: tenant.id,
      eventType: 'verification.success',
      resourceId: documentId,
      ipAddress,
      payload: { method: 'qr_scan' },
    });

    const status = document.status === 'REVOKED'
      ? 'revoked'
      : document.expiresAt && document.expiresAt < new Date()
      ? 'expired'
      : 'authentic';

    return {
      status,
      document: this.mapDocumentToPublic(document),
      issuer: {
        name: `${document.issuer.firstName} ${document.issuer.lastName}`,
        department: document.department.name,
        organization: document.tenant.name,
        logoUrl: document.tenant.logoUrl ?? undefined,
      },
      verifiedAt: new Date().toISOString(),
    };
  }

  async revokeDocument(documentId: string, reason: string, actor: JwtPayload, ipAddress: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (document.status === 'REVOKED') throw new BadRequestException('Document already revoked');

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
        revokedById: actor.sub,
      },
    });

    // Revoke on blockchain
    await this.blockchain.revokeDocument({
      documentId,
      tenantId: actor.tenantId,
      revokedAt: new Date().toISOString(),
      reason,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      actorId: actor.sub,
      eventType: 'document.revoked',
      resourceId: documentId,
      ipAddress,
      payload: { reason },
    });

    return updated;
  }

  async listDocuments(tenantId: string, departmentId?: string, page = 1, limit = 20) {
    const where = { tenantId, ...(departmentId ? { departmentId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          issuer: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDocument(documentId: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: {
        issuer: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async generateQrCode(documentId: string, tenantId: string): Promise<string> {
    const doc = await this.getDocument(documentId, tenantId);
    return QRCode.toDataURL(doc.qrUrl, { errorCorrectionLevel: 'H', margin: 2 });
  }

  private mapDocumentToPublic(doc: {
    id: string;
    title: string;
    documentType: string;
    issuedTo?: string | null;
    status: string;
    qrUrl: string;
    createdAt: Date;
    customFields?: unknown;
    tags: string[];
  }) {
    return {
      id: doc.id,
      status: doc.status.toLowerCase() as 'active' | 'revoked' | 'expired',
      metadata: {
        type: doc.documentType as never,
        title: doc.title,
        issuedTo: doc.issuedTo ?? undefined,
        tags: doc.tags,
        customFields: doc.customFields as Record<string, string> | undefined,
      },
      issuedAt: doc.createdAt.toISOString(),
      qrUrl: doc.qrUrl,
    };
  }
}
