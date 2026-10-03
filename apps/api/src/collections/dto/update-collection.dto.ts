import { IsArray, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { COLLECTION_STATUSES } from '../../common/constants';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10000)
  description?: string;

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

}
