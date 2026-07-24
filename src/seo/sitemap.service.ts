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
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { escapeXml } from '../common/utils/xml-escape.util';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
}

@Injectable()
export class SitemapService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly configService: ConfigService,
  ) {}

  async generateSitemap(space: PostSpace): Promise<string> {
    const baseUrl = this.getBaseUrl(space);

    const urls: SitemapUrl[] = [];

    // Homepage — highest priority, changes often
    urls.push({
      loc: baseUrl,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: '1.0',
    });

    // Category pages
    const categories = await this.categoryModel
      .find({ space })
      .select('slug updatedAt')
      .lean()
      .exec();

    for (const category of categories) {
      urls.push({
        loc: `${baseUrl}/category/${category.slug}`,
        lastmod: category.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: '0.7',
      });
    }

    // Published posts — the bulk of the sitemap
    const posts = await this.postModel
      .find({ space, status: PostStatus.PUBLISHED })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    for (const post of posts) {
      urls.push({
        loc: `${baseUrl}/posts/${post.slug}`,
        lastmod: post.updatedAt.toISOString(),
        changefreq: 'monthly',
        priority: '0.8',
      });
    }

    return this.buildXml(urls);
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

  private buildXml(urls: SitemapUrl[]): string {
    const urlEntries = urls
      .map(
        (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
  }
}
