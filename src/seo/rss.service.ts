import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import {
  Post,
  PostDocument,
  PostStatus,
  PostSpace,
} from '../posts/schemas/post.schema';
import { escapeXml } from '../common/utils/xml-escape.util';

const FEED_ITEM_LIMIT = 50;

@Injectable()
export class RssService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly configService: ConfigService,
  ) {}

  async generateFeed(space: PostSpace): Promise<string> {
    const baseUrl = this.getBaseUrl(space);
    const siteName = this.getSiteName(space);
    const siteDescription = this.getSiteDescription(space);

    const posts = await this.postModel
      .find({ space, status: PostStatus.PUBLISHED })
      .populate('author')
      .sort({ createdAt: -1 })
      .limit(FEED_ITEM_LIMIT)
      .lean()
      .exec();

    const items = posts
      .map((post) => {
        const author = post.author as unknown as { name?: string } | null;
        const link = `${baseUrl}/posts/${post.slug}`;
        const description = post.summary || post.body.slice(0, 300);

        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
      ${author?.name ? `<author>${escapeXml(author.name)}</author>` : ''}
      ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getBaseUrl(space: PostSpace): string {
    if (space === PostSpace.DEVSCRIPT) {
      return this.configService.get<string>('seo.devscriptUrl') ?? '';
    }
    if (space === PostSpace.PERSONAL) {
      return this.configService.get<string>('seo.miskJournalUrl') ?? '';
    }
    throw new BadRequestException(`Unknown space: ${space as string}`);
  }

  private getSiteName(space: PostSpace): string {
    const names =
      this.configService.get<Record<string, string>>('seo.siteName');
    return names?.[space] ?? 'Blog';
  }

  private getSiteDescription(space: PostSpace): string {
    const descriptions = this.configService.get<Record<string, string>>(
      'seo.siteDescription',
    );
    return descriptions?.[space] ?? '';
  }
}
