import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from '../posts/schemas/post.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { SitemapService } from './sitemap.service';
import { RssService } from './rss.service';
import { SeoController } from './seo.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  providers: [SitemapService, RssService],
  controllers: [SeoController],
})
export class SeoModule {}
