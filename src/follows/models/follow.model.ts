import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { PublicUserModel } from '../../users/models/public-user.model';

@ObjectType()
export class FollowModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => PublicUserModel, { nullable: true })
  declare follower?: PublicUserModel;

  @Field(() => PublicUserModel, { nullable: true })
  declare following?: PublicUserModel;

  @Field()
  declare createdAt: Date;
}

// Paginated list of followers/following
@ObjectType()
export class PaginatedUsers {
  @Field(() => [PublicUserModel])
  declare users: PublicUserModel[];

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
