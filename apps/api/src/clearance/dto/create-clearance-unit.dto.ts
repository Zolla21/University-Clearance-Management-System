import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateClearanceUnitDto {
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
}
