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

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    NotificationsModule,
    FollowsModule, // (for getFollowerIds)
    CategoriesModule, // (for getRelatedPosts)
    CommonModule, // (for UploadService)
    GalleryImageResolver,
    PostCoverImageResolver,
  ],
  providers: [PostsService, PostsResolver],
  controllers: [PostsController],
  exports: [PostsService], // export for AiModule
})
export class PostsModule {}
