import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsMongoId,
  IsOptional,
} from 'class-validator';

@InputType()
export class CreateCommentInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  declare body: string;

  @Field(() => ID)
  @IsMongoId()
  declare postId: string;

  // Optional - if provided, this is a reply
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  declare parentId?: string;
}
