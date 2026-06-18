import {
  Controller,
  Post,
  Delete,
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

import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({ name: 'userId', description: 'User ID to follow' })
  @ApiResponse({ status: 200, description: 'Followed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 409, description: 'Already following' })
  async follow(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: UserDocument,
  ) {
    await this.followsService.follow(userId, currentUser);
    return { message: 'Followed successfully' };
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({ name: 'userId', description: 'User ID to unfollow' })
  @ApiResponse({ status: 200, description: 'Unfollowed successfully' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  async unfollow(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: UserDocument,
  ) {
    await this.followsService.unfollow(userId, currentUser);
    return { message: 'Unfollowed successfully' };
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get followers of a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: 'Followers returned' })
  async getFollowers(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.followsService.getFollowers(userId, cursor);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get users that a user is following' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: 'Following list returned' })
  async getFollowing(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.followsService.getFollowing(userId, cursor);
  }

  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get follow stats for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'currentUserId', required: false })
  @ApiResponse({ status: 200, description: 'Follow stats returned' })
  async getStats(
    @Param('userId') userId: string,
    @Query('currentUserId') currentUserId?: string,
  ) {
    return this.followsService.getStats(userId, currentUserId);
  }
}
