import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  ArrayMaxSize,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { PostSpace, PostType } from '../schemas/post.schema';
import { IsValidPostTypeForSpace } from '../validators/post-type-space-match.validator';

@InputType()
export class CreatePostInput {
  @Field()
  @IsString()
  @MinLength(5, { message: 'Title must be at least 5 characters' })
  @MaxLength(150, { message: 'Title cannot exceed 150 characters' })
  declare title: string;

  @Field()
  @IsString()
  @MinLength(50, { message: 'Body must be at least 50 characters' })
  declare body: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  declare tags?: string[];

  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;

  @Field(() => PostType, { nullable: true })
  @IsOptional()
  @IsEnum(PostType)
  @IsValidPostTypeForSpace({
    message: ({ value, object }) => {
      const space = (object as { space?: PostSpace }).space;
      return `"${value as string}" is not a valid post type for space "${space as string}". Check allowed combinations.`;
    },
  })
  declare postType?: PostType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare categoryId?: string;
}
