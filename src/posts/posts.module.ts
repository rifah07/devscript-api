import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from './schemas/post.schema';
import { PostsService } from './posts.service';
import { PostsResolver } from './posts.resolver';
import { PostsController } from './posts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { CategoriesModule } from '../categories/categories.module';
import { CommonModule } from '../common/common.module';
import { GalleryImageResolver } from './resolvers/gallery-image.resolver';
import { PostCoverImageResolver } from './resolvers/post-cover-image.resolver';
import { ScheduleModule } from '@nestjs/schedule';
import { PostsCronService } from './posts.cron';
import { NewsletterModule } from '../newsletter/newsletter.module';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PostGalleryModel } from './models/post-gallery.model';
import { AiModule } from '../ai/ai.module';
import { AiResolver } from '../ai/ai.resolver';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Reaction, ReactionSchema } from '../reactions/schemas/reaction.schema';
import { Bookmark, BookmarkSchema } from '../bookmarks/schemas/bookmark.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
// PostGalleryModel doesn't need separate registration -
// it's automatically picked up since it's used as a return type
// in PostsResolver, which is already a provider.

@Module({
  imports: [
    // Other modules' schemas are registered here only for cascade deletes.
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Reaction.name, schema: ReactionSchema },
      { name: Bookmark.name, schema: BookmarkSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Series.name, schema: SeriesSchema },
    ]),
    AiModule,
    NotificationsModule,
    FollowsModule, // (for getFollowerIds)
    CategoriesModule, // (for getRelatedPosts)
    CommonModule, // (for UploadService)
    ScheduleModule.forRoot(), // enables @Cron() decorators
    NewsletterModule,
  ],
  providers: [
    PostsService,
    PostsResolver,
    PostsCronService,
    GalleryImageResolver,
    PostCoverImageResolver,
    AiResolver,
  ],
  controllers: [PostsController],
  exports: [PostsService], // export for AiModule
})
export class PostsModule {}
