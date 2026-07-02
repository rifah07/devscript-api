import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Bookmark, BookmarkSchema } from './schemas/bookmark.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { BookmarksService } from './bookmarks.service';
import { BookmarksResolver } from './bookmarks.resolver';
import { BookmarksController } from './bookmarks.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bookmark.name, schema: BookmarkSchema },
      { name: Post.name, schema: PostSchema }, // needed for bookmarksCount update
    ]),
  ],
  providers: [BookmarksService, BookmarksResolver],
  controllers: [BookmarksController],
  exports: [BookmarksService],
})
export class BookmarksModule {}
