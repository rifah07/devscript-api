import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { BookmarksService } from './bookmarks.service';
import { PaginatedPosts } from '../posts/models/post.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver()
export class BookmarksResolver {
  constructor(private readonly bookmarksService: BookmarksService) {}

  // Returns true if bookmarked, false if removed
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async toggleBookmark(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.bookmarksService.toggle(postId, user);
  }

  @Query(() => PaginatedPosts, { name: 'myBookmarks' })
  @UseGuards(JwtAuthGuard)
  async getMyBookmarks(
    @CurrentUser() user: UserDocument,
    @Args('cursor', { type: () => ID, nullable: true }) cursor?: string,
  ): Promise<PaginatedPosts> {
    return this.bookmarksService.getUserBookmarks(user._id.toString(), cursor);
  }

  @Query(() => Boolean, { name: 'isBookmarked' })
  @UseGuards(JwtAuthGuard)
  async checkBookmark(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.bookmarksService.isBookmarked(postId, user._id.toString());
  }
}
