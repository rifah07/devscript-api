import { InputType, Field, ID, Int } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  MinLength,
  IsMongoId,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

import { Type } from 'class-transformer';
import { PostSpace } from '../../posts/schemas/post.schema';

@InputType()
export class SearchInput {
  @Field()
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  declare query: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  declare tag?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare authorId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare cursor?: string;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @Type(() => Number) // REST query strings arrive as "10"
  @IsInt()
  @Min(1)
  @Max(20)
  declare limit?: number;

  // Required: each site searches only its own space.
  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
