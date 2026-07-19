import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import slugify from 'slugify';

import { Category, CategoryDocument } from './schemas/category.schema';
import { CategoryModel } from './models/category.model';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { Post, PostDocument, PostSpace } from '../posts/schemas/post.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async create(input: CreateCategoryInput): Promise<CategoryModel> {
    const slug = slugify(input.name, { lower: true, strict: true });

    const existing = await this.categoryModel.findOne({
      $or: [{ name: input.name }, { slug }],
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    const category = await this.categoryModel.create({
      name: input.name,
      slug,
      space: input.space,
      description: input.description ?? '',
    });

    return this.toModel(category);
  }

  async findById(id: string): Promise<CategoryModel> {
    const category = await this.categoryModel.findById(id).lean().exec();
    if (!category) throw new NotFoundException('Category not found');
    return this.toModel(category);
  }

  async findAll(): Promise<CategoryModel[]> {
    const categories = await this.categoryModel
      .find()
      .sort({ postCount: -1, name: 1 })
      .lean()
      .exec();

    return categories.map((c) => this.toModel(c));
  }

  async findAllBySpace(space: PostSpace): Promise<CategoryModel[]> {
    const categories = await this.categoryModel
      .find({ space })
      .sort({ postCount: -1, name: 1 })
      .lean()
      .exec();

    return categories.map((c) => this.toModel(c));
  }

  async findBySlug(slug: string): Promise<CategoryModel> {
    const category = await this.categoryModel.findOne({ slug }).lean().exec();

    if (!category) throw new NotFoundException('Category not found');
    return this.toModel(category);
  }

  async update(input: UpdateCategoryInput): Promise<CategoryModel> {
    const category = await this.categoryModel.findById(input.id);
    if (!category) throw new NotFoundException('Category not found');

    if (input.name) {
      category.name = input.name;
      category.slug = slugify(input.name, { lower: true, strict: true });
    }
    if (input.description !== undefined) {
      category.description = input.description;
    }

    await category.save();
    return this.toModel(category);
  }

  async remove(id: string): Promise<boolean> {
    const postsUsingCategory = await this.postModel.countDocuments({
      category: id,
    });

    if (postsUsingCategory > 0) {
      throw new BadRequestException(
        `Cannot delete category — ${postsUsingCategory} posts are using it. Reassign them first.`,
      );
    }

    const result = await this.categoryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Category not found');
    return true;
  }

  // Called by PostsService when a post's category changes
  async incrementPostCount(categoryId: string): Promise<void> {
    await this.categoryModel.updateOne(
      { _id: categoryId },
      { $inc: { postCount: 1 } },
    );
  }

  async decrementPostCount(categoryId: string): Promise<void> {
    await this.categoryModel.updateOne(
      { _id: categoryId },
      { $inc: { postCount: -1 } },
    );
  }

  private toModel(doc: CategoryDocument): CategoryModel {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      space: doc.space,
      postCount: doc.postCount,
      createdAt: doc.createdAt,
    };
  }
}
