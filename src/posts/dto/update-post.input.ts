import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';
import { CreatePostInput } from './create-post.input';

// PartialType makes all fields from CreatePostInput optional
@InputType()
export class UpdatePostInput extends PartialType(CreatePostInput) {
  @Field(() => ID)
  @IsMongoId({ message: 'Invalid post ID' })
  declare id: string;
}
