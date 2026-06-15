import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@InputType()
export class FollowInput {
  @Field(() => ID)
  @IsMongoId()
  declare userId: string; // the user to follow/unfollow
}
