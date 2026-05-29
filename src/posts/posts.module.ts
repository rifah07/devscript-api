import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from './schemas/post.schema';
import { PostsService } from './posts.service';
import { PostsResolver } from './posts.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  providers: [PostsService, PostsResolver],
  exports: [PostsService], // export for AiModule
})
export class PostsModule {}
