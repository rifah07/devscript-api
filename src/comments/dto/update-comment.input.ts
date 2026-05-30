import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, MinLength, MaxLength, IsMongoId } from 'class-validator';

@InputType()
export class UpdateCommentInput {
  @Field(() => ID)
  @IsMongoId()
  declare id: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  declare body: string;
}
