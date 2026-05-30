import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { PostsService } from './posts.service';
import { CreatePostInput } from './dto/create-post.input';
import { PostStatus } from './schemas/post.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() dto: CreatePostInput,
    @CurrentUser() user: UserDocument,
  ) {
    return this.postsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated posts' })
  @ApiQuery({ name: 'status', enum: PostStatus, required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Last post _id for pagination',
  })
  @ApiResponse({ status: 200, description: 'Paginated posts returned' })
  async findAll(
    @Query('status') status?: PostStatus,
    @Query('tag') tag?: string,
    @Query('authorId') authorId?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.findAll({ status, tag, authorId, cursor });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a post by slug' })
  @ApiParam({ name: 'slug', description: 'Post slug' })
  @ApiResponse({ status: 200, description: 'Post returned' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post updated' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: CreatePostInput,
    @CurrentUser() user: UserDocument,
  ) {
    return this.postsService.update({ ...dto, id }, user);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post published' })
  async publish(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.publish(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your post' })
  async remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.postsService.remove(id, user);
  }
}
