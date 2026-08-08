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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PostGalleryModel } from './models/post-gallery.model';
// PostGalleryModel doesn't need separate registration —
// it's automatically picked up since it's used as a return type
// in PostsResolver, which is already a provider.

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    NotificationsModule,
    FollowsModule, // (for getFollowerIds)
    CategoriesModule, // (for getRelatedPosts)
    CommonModule, // (for UploadService)
    GalleryImageResolver,
    PostCoverImageResolver,
    ScheduleModule.forRoot(), // enables @Cron() decorators
  ],
  providers: [PostsService, PostsResolver, PostsCronService],
  controllers: [PostsController],
  exports: [PostsService], // export for AiModule
})
export class PostsModule {}
