import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../schemas/report.schema';
import { UserModel } from '../../users/models/user.model';

registerEnumType(ReportReason, { name: 'ReportReason' });
registerEnumType(ReportStatus, { name: 'ReportStatus' });
registerEnumType(ReportTargetType, { name: 'ReportTargetType' });

@ObjectType()
export class ReportModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => UserModel, { nullable: true })
  declare reporter?: UserModel;

  @Field(() => ID)
  declare targetId: string;

  @Field(() => ReportTargetType)
  declare targetType: ReportTargetType;

  @Field(() => ReportReason)
  declare reason: ReportReason;

  @Field({ nullable: true })
  declare description?: string;

  @Field(() => ReportStatus)
  declare status: ReportStatus;

  @Field(() => UserModel, { nullable: true })
  declare reviewedBy?: UserModel;

  @Field({ nullable: true })
  declare adminNote?: string;

  @Field()
  declare createdAt: Date;
}

@ObjectType()
export class PaginatedReports {
  @Field(() => [ReportModel])
  declare reports: ReportModel[];

  @Field({ nullable: true })
  declare nextCursor?: string;

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Number)
  declare totalCount: number;
}
