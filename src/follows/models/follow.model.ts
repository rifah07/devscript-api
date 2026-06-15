import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model';

@ObjectType()
export class FollowModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => UserModel, { nullable: true })
  declare follower?: UserModel;

  @Field(() => UserModel, { nullable: true })
  declare following?: UserModel;

  @Field()
  declare createdAt: Date;
}

// Paginated list of followers/following
@ObjectType()
export class PaginatedUsers {
  @Field(() => [UserModel])
  declare users: UserModel[];

  @Field({ nullable: true })
  declare nextCursor?: string;

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Int)
  declare totalCount: number;
}

// Stats for a user's profile page
@ObjectType()
export class FollowStats {
  @Field(() => Int)
  declare followersCount: number;

  @Field(() => Int)
  declare followingCount: number;

  // Is the current viewer following this user?
  @Field()
  declare isFollowing: boolean;
}
