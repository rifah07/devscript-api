import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsMongoId } from 'class-validator';
import { PostStatus } from '../schemas/post.schema';

@InputType()
export class PostsFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare cursor?: string; // last post ID from previous page

  @Field({ nullable: true })
  @IsOptional()
  declare tag?: string;

  @Field({ nullable: true })
  @IsOptional()
  declare status?: PostStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare authorId?: string; // filter posts by a specific user
}
