import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Series, SeriesSchema } from './schemas/series.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { SeriesService } from './series.service';
import { SeriesResolver } from './series.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Series.name, schema: SeriesSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  providers: [SeriesService, SeriesResolver],
  exports: [SeriesService],
})
export class SeriesModule {}
