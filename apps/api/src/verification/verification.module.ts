import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DocumentsModule],
  controllers: [VerificationController],
})
export class VerificationModule {}
