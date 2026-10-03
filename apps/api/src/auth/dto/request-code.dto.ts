import { IsString, Matches } from 'class-validator';

export class RequestCodeDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone!: string;
}
