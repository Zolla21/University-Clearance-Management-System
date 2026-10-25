
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ClearanceDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export class ReviewClearanceItemDto {
  @IsEnum(ClearanceDecision)
  decision!: ClearanceDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
