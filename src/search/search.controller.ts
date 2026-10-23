import { Controller, Get, ParseEnumPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchInput } from './dto/search.input';
import { PostSpace } from '../posts/schemas/post.schema';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Query params go through the same SearchInput DTO as GraphQL, so the
  // global ValidationPipe checks them too.
  @Get()
  @ApiOperation({ summary: 'Search published posts by text' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async searchPosts(@Query() input: SearchInput) {
    return this.searchService.searchPosts(input);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top posts by view count' })
  @ApiQuery({ name: 'space', enum: PostSpace })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopPosts(
    @Query('space', new ParseEnumPipe(PostSpace)) space: PostSpace,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.getTopPosts(
      space,
      limit ? parseInt(limit, 10) || 10 : 10,
    );
  }

  @Get('trending-tags')
  @ApiOperation({ summary: 'Get trending tags in one space' })
  @ApiQuery({ name: 'space', enum: PostSpace })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTrendingTags(
    @Query('space', new ParseEnumPipe(PostSpace)) space: PostSpace,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.getTrendingTags(
      space,
      limit ? parseInt(limit, 10) || 20 : 20,
    );
  }
}
