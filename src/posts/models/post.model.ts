import { Field, ID, ObjectType, Int, registerEnumType } from '@nestjs/graphql';
import { PostStatus } from '../schemas/post.schema';
import { UserModel } from '../../users/models/user.model';

registerEnumType(PostStatus, { name: 'PostStatus' });

@ObjectType()
export class PostModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare title: string;

  @Field()
  declare slug: string;

  @Field()
  declare body: string;

  @Field({ nullable: true })
  declare summary?: string;

  @Field(() => [String])
  declare tags: string[];

  // Author can be populated (full UserModel) or just an ID
  // nullable: true handles the case where author was deleted
  @Field(() => UserModel, { nullable: true })
  declare author?: UserModel;

  @Field(() => PostStatus)
  declare status: PostStatus;

  @Field(() => Int)
  declare readTime: number;

  @Field(() => Int)
  declare viewCount: number;

  @Field(() => Int)
  declare bookmarksCount: number;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;
}

// Cursor-based pagination response type
@ObjectType()
export class PaginatedPosts {
  @Field(() => [PostModel])
  declare posts: PostModel[];

  @Field({ nullable: true })
  declare nextCursor?: string; // ID of last item - client sends this for next page

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Int)
  declare totalCount: number;
}
