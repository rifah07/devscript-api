import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

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
  @MaxLength(72) // bcrypt ignores everything after 72 bytes
  declare password: string;

  // Which site the verification email should link to and be branded as.
  @Field(() => PostSpace, { nullable: true })
  @IsOptional()
  @IsEnum(PostSpace)
  declare space?: PostSpace;
}
