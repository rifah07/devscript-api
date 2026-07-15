import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from './schemas/post.schema';
import { PostsService } from './posts.service';
import { PostsResolver } from './posts.resolver';
import { PostsController } from './posts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    NotificationsModule,
    FollowsModule, // (for getFollowerIds)
    CategoriesModule, // (for getRelatedPosts)
  ],
  providers: [PostsService, PostsResolver],
  controllers: [PostsController],
  exports: [PostsService], // export for AiModule
})
export class PostsModule {}
