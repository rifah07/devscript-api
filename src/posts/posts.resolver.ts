import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { PostsService } from './posts.service';
import { PostModel, PaginatedPosts } from './models/post.model';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { PostsFilterInput } from './dto/posts-filter.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AuthorAnalytics } from './models/author-analytics.model';

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
  async getPosts(
    @Args('filter', { nullable: true }) filter?: PostsFilterInput,
  ): Promise<PaginatedPosts> {
    return this.postsService.findAll(filter ?? {});
  }

  @Query(() => PostModel, { name: 'post' })
  async getPostBySlug(@Args('slug') slug: string): Promise<PostModel> {
    return this.postsService.findBySlug(slug);
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
  @UseGuards(JwtAuthGuard)
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

  @Mutation(() => Boolean)
  async recordPostView(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('viewerId', { type: () => ID, nullable: true }) viewerId?: string,
  ): Promise<boolean> {
    await this.postsService.recordView(postId, viewerId);
    return true;
  }

  @Query(() => AuthorAnalytics, { name: 'myAnalytics' })
  @UseGuards(JwtAuthGuard)
  async getMyAnalytics(
    @CurrentUser() user: UserDocument,
  ): Promise<AuthorAnalytics> {
    return this.postsService.getAuthorAnalytics(user._id.toString());
  }
}
