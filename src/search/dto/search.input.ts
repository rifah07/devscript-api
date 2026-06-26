import { InputType, Field, ID, Int } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  MinLength,
  IsMongoId,
  IsInt,
  Min,
  Max,
} from 'class-validator';

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
  @IsInt()
  @Min(1)
  @Max(20)
  declare limit?: number;
}
