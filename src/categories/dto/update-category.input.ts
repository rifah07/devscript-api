import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';
import { CreateCategoryInput } from './create-category.input';

@InputType()
export class UpdateCategoryInput extends PartialType(CreateCategoryInput) {
  @Field(() => ID)
  @IsMongoId()
  declare id: string;
}
