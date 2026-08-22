import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsEnum } from 'class-validator';
import { PostSpace } from '../../posts/schemas/post.schema';

@InputType()
export class SubscribeInput {
  @Field()
  @IsEmail()
  declare email: string;

  @Field(() => PostSpace)
  @IsEnum(PostSpace)
  declare space: PostSpace;
}
