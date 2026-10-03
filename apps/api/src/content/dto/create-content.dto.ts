import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateContentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsIn(['video', 'audio_text'])
  kind?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(30000)
  script!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  narrationText?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewerNote?: string;

}
