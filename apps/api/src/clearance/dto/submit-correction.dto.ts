
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitCorrectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  correctionComment!: string;
}
