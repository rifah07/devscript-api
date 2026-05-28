import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  ArrayMaxSize,
} from 'class-validator';

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
}
