import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Int,
  Context,
} from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostModel, PaginatedPosts } from './models/post.model';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { PostsFilterInput } from './dto/posts-filter.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { TypedRequest } from '../common/interfaces/typed-request.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AuthorAnalytics } from './models/author-analytics.model';
import { PostGalleryModel } from './models/post-gallery.model';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';

@Resolver(() => PostModel)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async createPost(
    @Args('input') input: CreatePostInput,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.create(input, user);
  }

  @Query(() => PaginatedPosts, { name: 'posts' })
  @UseGuards(OptionalJwtAuthGuard)
  async getPosts(
    @CurrentUser() user: UserDocument | null,
    @Args('filter', { nullable: true }) filter?: PostsFilterInput,
  ): Promise<PaginatedPosts> {
    return this.postsService.findAll(filter ?? {}, user);
  }

  @Query(() => PostModel, { name: 'post' })
  @UseGuards(OptionalJwtAuthGuard)
  async getPostBySlug(
    @Args('slug') slug: string,
    @CurrentUser() user: UserDocument | null,
  ): Promise<PostModel> {
    return this.postsService.findBySlug(slug, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async updatePost(
    @Args('input') input: UpdatePostInput,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.update(input, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async publishPost(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.publish(id, user);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deletePost(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.postsService.remove(id, user);
  }

  // The viewer comes from the token, never from an argument: a client-sent
  // viewerId let anyone inflate counts or probe another user's history.
  @Mutation(() => Boolean)
  @UseGuards(OptionalJwtAuthGuard)
  async recordPostView(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument | null,
    @Context('req') req: TypedRequest,
  ): Promise<boolean> {
    const userAgent = req.headers['user-agent'];
    await this.postsService.recordView(
      postId,
      user,
      req.ip,
      typeof userAgent === 'string' ? userAgent : '',
    );
    return true;
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async schedulePost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('scheduledAt') scheduledAt: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.schedulePost(postId, scheduledAt, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async cancelSchedule(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.cancelSchedule(postId, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async generateNarration(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.generateNarration(postId, user);
  }

  @Query(() => AuthorAnalytics, { name: 'myAnalytics' })
  @UseGuards(JwtAuthGuard)
  async getMyAnalytics(
    @CurrentUser() user: UserDocument,
  ): Promise<AuthorAnalytics> {
    return this.postsService.getAuthorAnalytics(user._id.toString());
  }

  @Query(() => [PostModel], { name: 'relatedPosts' })
  @UseGuards(OptionalJwtAuthGuard)
  async getRelatedPosts(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument | null,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<PostModel[]> {
    return this.postsService.getRelatedPosts(postId, user, limit ?? 5);
  }

  @Query(() => PostGalleryModel, { name: 'postGallery' })
  @UseGuards(OptionalJwtAuthGuard)
  async getPostGallery(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument | null,
  ): Promise<PostGalleryModel> {
    return this.postsService.getPostGallery(postId, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async setPostCover(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('publicId') publicId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.setPostCover(postId, publicId, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async reorderGallery(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('publicIds', { type: () => [String] }) publicIds: string[],
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.reorderGallery(postId, publicIds, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async updateGalleryImageAlt(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('publicId') publicId: string,
    @Args('alt') alt: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.postsService.updateGalleryImageAlt(postId, publicId, alt, user);
  }

  // Public and unauthenticated, so it is throttled hard against inflation.
  @Mutation(() => Boolean)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async trackImageDownload(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('publicId') publicId: string,
  ): Promise<boolean> {
    await this.postsService.incrementImageDownloadCount(postId, publicId);
    return true;
  }
}
