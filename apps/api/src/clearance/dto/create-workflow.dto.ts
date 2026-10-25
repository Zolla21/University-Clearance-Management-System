import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @Length(2, 30)
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsUUID()
  templateId!: string;
}