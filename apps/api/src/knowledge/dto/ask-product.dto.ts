import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  question!: string;
}
