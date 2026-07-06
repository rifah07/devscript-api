import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class PlatformStats {
  @Field(() => Int)
  declare totalUsers: number;

  @Field(() => Int)
  declare totalPosts: number;

  @Field(() => Int)
  declare totalComments: number;

  @Field(() => Int)
  declare totalReactions: number;

  @Field(() => Int)
  declare totalBookmarks: number;

  @Field(() => Int)
  declare pendingReports: number;

  // New registrations in last 30 days
  @Field(() => Int)
  declare newUsersThisMonth: number;

  // Posts published in last 30 days
  @Field(() => Int)
  declare newPostsThisMonth: number;
}
