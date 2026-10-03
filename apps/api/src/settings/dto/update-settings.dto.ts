import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(120) venueName?: string;
  @IsOptional() @IsString() @MaxLength(300) venueTagline?: string;
  @IsOptional() @IsUrl({ require_tld: false }) publicWebUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) nfcBaseUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) defaultPixelleWorkflow?: string;
  @IsOptional() @IsString() @MaxLength(200) defaultFrameTemplate?: string;
  @IsOptional() @IsInt() @Min(5) @Max(3600) defaultVideoDurationSeconds?: number;
  @IsOptional() @IsIn(['video', 'script']) defaultOutputMode?: 'video' | 'script';
  @IsOptional() @IsString() @MaxLength(20) defaultLanguage?: string;
  @IsOptional() @IsObject() moderationPolicy?: Record<string, unknown>;
  @IsOptional() @IsObject() publicCopy?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsString({ each: true }) catalogCategories?: string[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(5, { each: true }) @Max(3600, { each: true }) workflowDurationOptions?: number[];
  @IsOptional() @IsBoolean() featureNfc?: boolean;
  @IsOptional() @IsBoolean() featureQr?: boolean;
  @IsOptional() @IsBoolean() featureAgent?: boolean;
}
