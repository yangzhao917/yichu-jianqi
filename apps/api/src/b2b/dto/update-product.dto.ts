import { IsArray, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(10000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) useCase?: string;
  @IsOptional() @IsString() @MaxLength(1000) audience?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsArray() specifications?: Array<{ label: string; value: string }>;
  @IsOptional() @IsArray() resources?: Array<{ title: string; url: string; kind?: string }>;
  @IsOptional() @IsUrl({ require_tld: false }) coverImageUrl?: string;
  @IsOptional() @IsIn(['draft', 'published', 'archived']) lifecycleStatus?: string;
}
