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
export class CreateCategoryInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  declare name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  declare description?: string;

  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
