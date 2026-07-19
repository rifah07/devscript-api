import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { PostSpace } from '../../posts/schemas/post.schema';

@ObjectType()
export class CategoryModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare name: string;

  @Field()
  declare slug: string;

  @Field({ nullable: true })
  declare description?: string;

  @Field(() => Int)
  declare postCount: number;

  @Field(() => PostSpace)
  declare space: PostSpace;

  @Field()
  declare createdAt: Date;
}
