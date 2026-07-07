import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsMongoId,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ReportReason, ReportTargetType } from '../schemas/report.schema';

@InputType()
export class CreateReportInput {
  @Field(() => ID)
  @IsMongoId()
  declare targetId: string;

  @Field(() => ReportTargetType)
  @IsEnum(ReportTargetType)
  declare targetType: ReportTargetType;

  @Field(() => ReportReason)
  @IsEnum(ReportReason)
  declare reason: ReportReason;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare description?: string;
}
