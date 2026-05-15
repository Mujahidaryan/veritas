import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { StorageService } from '../storage/storage.service';

interface StoreFileJob {
  documentId: string;
  tenantId: string;
  buffer: string; // base64
  mimetype: string;
  originalName: string;
}

@Processor('documents')
export class DocumentsProcessor {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(private storage: StorageService) {}

  @Process('store-file')
  async handleStoreFile(job: Job<StoreFileJob>) {
    const { documentId, tenantId, buffer, mimetype, originalName } = job.data;
    const fileBuffer = Buffer.from(buffer, 'base64');

    await this.storage.uploadEncrypted(
      `${tenantId}/${documentId}/${originalName}`,
      fileBuffer,
      mimetype,
    );

    this.logger.log(`Stored file for document ${documentId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
