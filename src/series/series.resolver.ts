import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { SeriesService } from './series.service';
import { SeriesModel } from './models/series.model';
import { PostModel } from '../posts/models/post.model';
import { CreateSeriesInput } from './dto/create-series.input';
import { AddPostToSeriesInput } from './dto/add-post-to-series.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver(() => SeriesModel)
export class SeriesResolver {
  constructor(private readonly seriesService: SeriesService) {}

  @Mutation(() => SeriesModel)
  @UseGuards(JwtAuthGuard)
  async createSeries(
    @Args('input') input: CreateSeriesInput,
    @CurrentUser() user: UserDocument,
  ): Promise<SeriesModel> {
    return this.seriesService.create(input, user);
  }

  @Query(() => [SeriesModel], { name: 'authorSeries' })
  async getAuthorSeries(
    @Args('authorId', { type: () => ID }) authorId: string,
  ): Promise<SeriesModel[]> {
    return this.seriesService.findAllByAuthor(authorId);
  }

  @Query(() => SeriesModel, { name: 'series' })
  async getSeriesBySlug(@Args('slug') slug: string): Promise<SeriesModel> {
    return this.seriesService.findBySlug(slug);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async addPostToSeries(
    @Args('input') input: AddPostToSeriesInput,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.seriesService.addPost(input, user);
  }

  @Mutation(() => PostModel)
  @UseGuards(JwtAuthGuard)
  async removePostFromSeries(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<PostModel> {
    return this.seriesService.removePost(postId, user);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteSeries(
    @Args('seriesId', { type: () => ID }) seriesId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.seriesService.remove(seriesId, user);
  }
}
