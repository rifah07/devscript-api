import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  declare email: string;

  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  declare name: string;

  @Field()
  @IsString()
  @MinLength(8)
  declare password: string;
}
