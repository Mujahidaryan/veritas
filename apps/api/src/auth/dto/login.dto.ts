// dto/login.dto.ts
import { IsEmail, IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'aga-khan-hospital' })
  @IsString()
  tenantSlug: string;

  @ApiProperty({ example: 'admin@hospital.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @Length(6, 6)
  mfaCode?: string;
}
