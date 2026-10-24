import { IsEnum, IsString, MaxLength } from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

export class VerifyEmailInput {
  @IsString()
  @MaxLength(100)
  declare token: string;
}

export class ResendVerificationInput {
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
