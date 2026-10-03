import { IsIn } from 'class-validator';

export class UpdateLeadDto {
  @IsIn(['new', 'contacted', 'qualified', 'closed', 'lost'])
  status!: string;
}
