import { ObjectType, Field, Int } from '@nestjs/graphql';
import { PostModel } from './post.model';

@ObjectType()
export class AuthorAnalytics {
  @Field(() => Int)
  declare totalViews: number;

  @Field(() => Int)
  declare totalPosts: number;

  @Field(() => Int)
  declare totalBookmarks: number;

  @Field(() => [PostModel])
  declare topPosts: PostModel[];
}
