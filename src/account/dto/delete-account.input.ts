import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class DeleteAccountInput {
  @Field()
  @IsString()
  @MinLength(1)
  declare password: string;
}
