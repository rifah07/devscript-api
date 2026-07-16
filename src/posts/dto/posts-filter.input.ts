import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { PostSpace, PostStatus } from '../schemas/post.schema';
import { PostType } from '../schemas/post.schema';

@InputType()
export class PostsFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare cursor?: string;

  @Field({ nullable: true })
  @IsOptional()
  declare tag?: string;

  @Field(() => PostStatus, { nullable: true }) // ← explicit enum type
  @IsOptional()
  @IsEnum(PostStatus)
  declare status?: PostStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare authorId?: string;

  @Field(() => PostSpace, { nullable: true })
  @IsOptional()
  @IsEnum(PostSpace)
  declare space?: PostSpace;

  @Field(() => PostType, { nullable: true })
  @IsOptional()
  @IsEnum(PostType)
  declare postType?: PostType;
}
