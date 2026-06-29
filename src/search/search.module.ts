import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from '../posts/schemas/post.schema';
import { SearchService } from './search.service';
import { SearchResolver } from './search.resolver';
import { SearchController } from './search.controller';

@Module({
  imports: [
    // Register Post model directly — cleaner than importing PostsModule
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  providers: [SearchService, SearchResolver],
  controllers: [SearchController],
})
export class SearchModule {}
