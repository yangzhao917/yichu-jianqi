import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewContentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  note!: string;
}
