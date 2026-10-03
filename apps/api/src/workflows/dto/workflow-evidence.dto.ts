import { IsBoolean, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class WorkflowEvidenceDto {
  @IsUrl({ require_tld: false })
  mediaUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  evidenceUrl?: string;

  @IsOptional()
  @IsObject()
  evidenceJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerVersion?: string;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
