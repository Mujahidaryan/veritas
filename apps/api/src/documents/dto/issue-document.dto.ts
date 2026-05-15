import {
  IsString, IsOptional, IsArray, IsDateString,
  IsObject, IsEnum, MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum DocumentTypeEnum {
  MEDICAL_REPORT = 'medical-report',
  PRESCRIPTION = 'prescription',
  DEGREE = 'degree',
  TRANSCRIPT = 'transcript',
  EMPLOYMENT_LETTER = 'employment-letter',
  LEGAL_CONTRACT = 'legal-contract',
  INSURANCE_POLICY = 'insurance-policy',
  FINANCIAL_STATEMENT = 'financial-statement',
  CUSTOM = 'custom',
}

export class IssueDocumentDto {
  @ApiProperty({ description: 'Department UUID' })
  @IsString()
  departmentId: string;

  @ApiProperty({ enum: DocumentTypeEnum })
  @IsEnum(DocumentTypeEnum)
  type: DocumentTypeEnum;

  @ApiProperty({ example: 'Blood Test Report - March 2025' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ required: false, example: 'patient-id-001' })
  @IsOptional()
  @IsString()
  issuedTo?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  customFields?: Record<string, string>;
}

export class RevokeDocumentDto {
  @ApiProperty({ example: 'Document issued in error' })
  @IsString()
  @MinLength(5)
  reason: string;
}
