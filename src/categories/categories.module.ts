import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Category, CategorySchema } from './schemas/category.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  providers: [CategoriesService, CategoriesResolver],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
