import { ObjectType, Field, Int } from '@nestjs/graphql';
import { PostModel } from '../../posts/models/post.model';

@ObjectType()
export class SearchResult {
  @Field(() => [PostModel])
  declare posts: PostModel[];

  @Field(() => Int)
  declare totalCount: number;

  @Field({ nullable: true })
  declare nextCursor?: string;

  @Field()
  declare hasNextPage: boolean;
}
