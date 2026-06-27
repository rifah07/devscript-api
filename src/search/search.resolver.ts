import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { ObjectType, Field } from '@nestjs/graphql';

import { SearchService } from './search.service';
import { SearchInput } from './dto/search.input';
import { SearchResult } from './models/search-result.model';
import { PostModel } from '../posts/models/post.model';

@ObjectType()
export class TrendingTag {
  @Field()
  declare tag: string;

  @Field(() => Int)
  declare count: number;
}

@Resolver()
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => SearchResult, { name: 'search' })
  async searchPosts(@Args('input') input: SearchInput): Promise<SearchResult> {
    return this.searchService.searchPosts(input);
  }

  @Query(() => [PostModel], { name: 'topPosts' })
  async getTopPosts(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<PostModel[]> {
    return this.searchService.getTopPosts(limit ?? 10);
  }

  @Query(() => [TrendingTag], { name: 'trendingTags' })
  async getTrendingTags(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<TrendingTag[]> {
    return this.searchService.getTrendingTags(limit ?? 20);
  }
}
