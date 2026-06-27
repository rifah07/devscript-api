import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search published posts by text' })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async searchPosts(
    @Query('query') query: string,
    @Query('tag') tag?: string,
    @Query('authorId') authorId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchPosts({
      query,
      tag,
      authorId,
      cursor,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top posts by view count' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopPosts(@Query('limit') limit?: string) {
    return this.searchService.getTopPosts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('trending-tags')
  @ApiOperation({ summary: 'Get trending tags across all posts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTrendingTags(@Query('limit') limit?: string) {
    return this.searchService.getTrendingTags(limit ? parseInt(limit, 10) : 20);
  }
}
