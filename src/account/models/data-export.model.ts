import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class DataExportResult {
  @Field()
  declare exportedAt: Date;

  @Field()
  declare downloadUrl: string;
}
