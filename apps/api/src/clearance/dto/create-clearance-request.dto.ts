
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateClearanceRequestDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  templateId: string;

  @IsUUID()
  workflowId: string;

  @IsIn(['SEMESTER', 'END_OF_YEAR', 'GRADUATION', 'OTHER'])
  clearanceType: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  otherReason?: string;
}
