import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@InputType()
export class AddGalleryImageInput {
  @Field(() => ID)
  @IsMongoId()
  declare postId: string;
}
