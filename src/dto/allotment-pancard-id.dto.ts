import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AllotmentByPancardIdDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ipoId!: number;

  @IsString()
  panCardId!: string;

  @IsOptional()
  @IsBoolean()
  isInCorrect: boolean = false;
}
