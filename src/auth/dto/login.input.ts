import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  declare email: string;

  @Field()
  @IsString()
  @MinLength(8)
  declare password: string;
}
