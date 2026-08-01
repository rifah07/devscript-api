import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

@InputType()
export class CreateSeriesInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  declare title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare description?: string;

  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
