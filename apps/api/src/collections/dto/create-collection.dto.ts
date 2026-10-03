import { IsArray, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { COLLECTION_STATUSES, PROVENANCE_STATUSES } from '../../common/constants';

export class ProvenanceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sourceName!: string;

  @IsUrl({ require_tld: false })
  sourceUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLocator?: string;

  @IsOptional()
  @IsIn(PROVENANCE_STATUSES)
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateCollectionDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  summary!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  era?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  useCase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  audience?: string;

  @IsOptional()
  @IsArray()
  specifications?: Array<{ label: string; value: string }>;

  @IsOptional()
  @IsArray()
  resources?: Array<{ title: string; url: string; kind?: string }>;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImageUrl?: string;

  @IsOptional()
  @IsIn(COLLECTION_STATUSES)
  lifecycleStatus?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProvenanceDto)
  provenance?: ProvenanceDto;
}
