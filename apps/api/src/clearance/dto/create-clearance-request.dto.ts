import { IsUUID } from 'class-validator';

export class CreateClearanceRequestDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  templateId: string;

  @IsUUID()
  workflowId: string;
}