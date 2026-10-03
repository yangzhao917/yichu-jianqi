import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  contentVersionId?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  durationSeconds?: number;

  @IsOptional()
  @IsIn(['video', 'script'])
  outputMode?: 'video' | 'script';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  frameTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workflowName?: string;
}
