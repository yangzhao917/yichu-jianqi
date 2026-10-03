import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateBrandDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUrl({ require_tld: false }) logoUrl?: string;
}
