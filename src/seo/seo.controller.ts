import {
  Controller,
  Get,
  Query,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { SitemapService } from './sitemap.service';
import { RssService } from './rss.service';
import { PostSpace } from '../posts/schemas/post.schema';

@ApiTags('SEO')
@Controller()
export class SeoController {
  constructor(
    private readonly sitemapService: SitemapService,
    private readonly rssService: RssService,
  ) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiOperation({ summary: 'Generate XML sitemap for search engines' })
  @ApiQuery({ name: 'space', enum: PostSpace, required: true })
  async getSitemap(@Query('space') space: PostSpace): Promise<string> {
    this.validateSpace(space);
    return this.sitemapService.generateSitemap(space);
  }

  @Get('rss.xml')
  @Header('Content-Type', 'application/rss+xml')
  @ApiOperation({ summary: 'Generate RSS feed for the given space' })
  @ApiQuery({ name: 'space', enum: PostSpace, required: true })
  async getRssFeed(@Query('space') space: PostSpace): Promise<string> {
    this.validateSpace(space);
    return this.rssService.generateFeed(space);
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Robots.txt for a given space' })
  @ApiQuery({ name: 'space', enum: PostSpace, required: true })
  getRobotsTxt(@Query('space') space: PostSpace): string {
    this.validateSpace(space);

    const sitemapUrl =
      space === PostSpace.DEVSCRIPT
        ? 'https://devscript.com/sitemap.xml'
        : 'https://themiskjournal.com/sitemap.xml';

    return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}`;
  }

  private validateSpace(space: unknown): void {
    if (space !== PostSpace.DEVSCRIPT && space !== PostSpace.PERSONAL) {
      throw new BadRequestException(
        'Invalid or missing "space" query parameter. Must be "devscript" or "personal".',
      );
    }
  }
}
