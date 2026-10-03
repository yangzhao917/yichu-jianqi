import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  registrationToken!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName!: string;

  @IsString()
  @Matches(/^[0-9A-Z]{18}$/i)
  creditCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
