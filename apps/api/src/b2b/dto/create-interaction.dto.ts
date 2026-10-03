import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInteractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brandSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productSlug?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsIn(['view', 'play', 'cta', 'share'])
  event!: string;

  @IsOptional()
  @IsIn(['nfc', 'qr', 'share', 'direct'])
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sessionId?: string;
}
