import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

@InputType()
export class ForgotPasswordInput {
  @Field()
  @IsEmail()
  declare email: string;

  // Which site the reset link and branding should point to.
  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsString()
  @MaxLength(100)
  declare token: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores everything after 72 bytes
  declare newPassword: string;
}

@InputType()
export class ExchangeCodeInput {
  @Field()
  @IsString()
  @MaxLength(100)
  declare code: string;
}
