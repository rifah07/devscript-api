import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsMongoId, IsInt, Min, IsOptional } from 'class-validator';

@InputType()
export class AddPostToSeriesInput {
  @Field(() => ID)
  @IsMongoId()
  declare seriesId: string;

  @Field(() => ID)
  @IsMongoId()
  declare postId: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  declare order?: number; // if omitted, appends to the end
}
