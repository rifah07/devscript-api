import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { PostSpace } from '../../posts/schemas/post.schema';
import { UserModel } from '../../users/models/user.model';
import { PostModel } from '../../posts/models/post.model';

@ObjectType()
export class SeriesModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare title: string;

  @Field()
  declare slug: string;

  @Field({ nullable: true })
  declare description?: string;

  @Field({ nullable: true })
  declare coverImageUrl?: string;

  @Field(() => UserModel, { nullable: true })
  declare author?: UserModel;

  @Field(() => PostSpace)
  declare space: PostSpace;

  @Field(() => Int)
  declare postCount: number;

  // Populated only when fetching a single series with its posts
  @Field(() => [PostModel], { nullable: true })
  declare posts?: PostModel[];

  @Field()
  declare createdAt: Date;
}
