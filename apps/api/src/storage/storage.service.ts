import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.storage = new Storage({
      projectId: config.get<string>('storage.gcsProjectId'),
    });
    this.bucket = config.get<string>('storage.gcsBucket', 'veritas-documents');
  }

  /**
   * Upload file with AES-256-GCM client-side encryption.
   * Only encrypted bytes reach GCS — Veritas holds the key, not Google.
   */
  async uploadEncrypted(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const encryptionKey = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Prepend IV + authTag to encrypted payload (first 16 bytes = IV, next 16 = authTag)
    const finalBuffer = Buffer.concat([iv, authTag, encrypted]);

    const file = this.storage.bucket(this.bucket).file(path);
    await file.save(finalBuffer, {
      metadata: {
        contentType: 'application/octet-stream', // Always store as binary
        metadata: {
          originalContentType: contentType,
          encrypted: 'aes-256-gcm',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Uploaded encrypted file: ${path}`);
    return path;
  }

  /**
   * Download and decrypt a file
   */
  async downloadDecrypted(path: string): Promise<{ buffer: Buffer; contentType: string }> {
    const file = this.storage.bucket(this.bucket).file(path);
    const [contents, metadata] = await Promise.all([
      file.download(),
      file.getMetadata(),
    ]);

    const payload = contents[0];
    const iv = payload.subarray(0, 16);
    const authTag = payload.subarray(16, 32);
    const encrypted = payload.subarray(32);

    const encryptionKey = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return {
      buffer: decrypted,
      contentType: (metadata[0].metadata?.['originalContentType'] as string) ?? 'application/octet-stream',
    };
  }

  async deleteFile(path: string): Promise<void> {
    await this.storage.bucket(this.bucket).file(path).delete({ ignoreNotFound: true });
  }

  private getEncryptionKey(): Buffer {
    const secret = this.config.get<string>('STORAGE_ENCRYPTION_KEY', '');
    if (!secret || secret.length < 32) {
      throw new Error('STORAGE_ENCRYPTION_KEY must be at least 32 characters');
    }
    return Buffer.from(secret.slice(0, 32), 'utf8');
  }
}
