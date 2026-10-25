
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const WORKFLOW_STEP_TYPES = [
  'START',
  'APPROVAL',
  'REVIEW',
  'END',
] as const;

export class CreateWorkflowStepDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(WORKFLOW_STEP_TYPES)
  type!: (typeof WORKFLOW_STEP_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}
