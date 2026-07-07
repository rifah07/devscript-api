import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsMongoId,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ReportStatus } from '../schemas/report.schema';

@InputType()
export class ReviewReportInput {
  @Field(() => ID)
  @IsMongoId()
  declare reportId: string;

  @Field(() => ReportStatus)
  @IsEnum(ReportStatus)
  declare status: ReportStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare adminNote?: string;
}
