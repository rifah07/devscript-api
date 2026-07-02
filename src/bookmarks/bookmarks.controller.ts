import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Bookmarks')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post(':postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle bookmark on a post' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'true = bookmarked, false = removed',
  })
  async toggle(
    @Param('postId') postId: string,
    @CurrentUser() user: UserDocument,
  ) {
    const added = await this.bookmarksService.toggle(postId, user);
    return {
      bookmarked: added,
      message: added ? 'Post bookmarked' : 'Bookmark removed',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get your bookmarked posts' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: 'Bookmarks returned' })
  async getMyBookmarks(
    @CurrentUser() user: UserDocument,
    @Query('cursor') cursor?: string,
  ) {
    return this.bookmarksService.getUserBookmarks(user._id.toString(), cursor);
  }

  @Get(':postId/check')
  @ApiOperation({ summary: 'Check if a post is bookmarked' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Boolean returned' })
  async checkBookmark(
    @Param('postId') postId: string,
    @CurrentUser() user: UserDocument,
  ) {
    const bookmarked = await this.bookmarksService.isBookmarked(
      postId,
      user._id.toString(),
    );
    return { bookmarked };
  }
}
