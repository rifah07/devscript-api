import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { FollowsService } from './follows.service';
import { PaginatedUsers, FollowStats } from './models/follow.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver()
export class FollowsResolver {
  constructor(private readonly followsService: FollowsService) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async followUser(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    return this.followsService.follow(userId, currentUser);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async unfollowUser(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    return this.followsService.unfollow(userId, currentUser);
  }

  @Query(() => PaginatedUsers, { name: 'followers' })
  async getFollowers(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('cursor', { type: () => ID, nullable: true }) cursor?: string,
  ): Promise<PaginatedUsers> {
    return this.followsService.getFollowers(userId, cursor);
  }

  @Query(() => PaginatedUsers, { name: 'following' })
  async getFollowing(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('cursor', { type: () => ID, nullable: true }) cursor?: string,
  ): Promise<PaginatedUsers> {
    return this.followsService.getFollowing(userId, cursor);
  }

  @Query(() => FollowStats, { name: 'followStats' })
  async getFollowStats(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('currentUserId', { type: () => ID, nullable: true })
    currentUserId?: string,
  ): Promise<FollowStats> {
    return this.followsService.getStats(userId, currentUserId);
  }
}
