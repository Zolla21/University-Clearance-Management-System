
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateClearanceTemplateDto {
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['SEMESTER', 'END_OF_YEAR', 'GRADUATION', 'OTHER'])
  clearanceType?: string;
}
