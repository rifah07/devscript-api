import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';

import { Series, SeriesDocument } from './schemas/series.schema';
import { SeriesModel } from './models/series.model';
import { CreateSeriesInput } from './dto/create-series.input';
import { AddPostToSeriesInput } from './dto/add-post-to-series.input';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { PostModel } from '../posts/models/post.model';
import { UserRole } from '../users/schemas/user.schema';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class SeriesService {
  constructor(
    @InjectModel(Series.name)
    private readonly seriesModel: Model<SeriesDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async create(
    input: CreateSeriesInput,
    author: UserDocument,
  ): Promise<SeriesModel> {
    const slug =
      slugify(input.title, { lower: true, strict: true }) + '-' + Date.now();

    const series = await this.seriesModel.create({
      title: input.title,
      slug,
      description: input.description ?? '',
      author: author._id,
      space: input.space,
    });

    await series.populate('author');
    return this.toModel(series);
  }

  async findAllByAuthor(authorId: string): Promise<SeriesModel[]> {
    const series = await this.seriesModel
      .find({ author: new Types.ObjectId(authorId) })
      .populate('author')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return series.map((s) => this.toModel(s));
  }

  async findBySlug(slug: string): Promise<SeriesModel> {
    const series = await this.seriesModel
      .findOne({ slug })
      .populate('author')
      .lean()
      .exec();

    if (!series) throw new NotFoundException('Series not found');

    // Fetch posts in this series, ordered
    const posts = await this.postModel
      .find({ series: series._id })
      .populate('author')
      .populate('category')
      .sort({ seriesOrder: 1 })
      .lean()
      .exec();

    const model = this.toModel(series);
    model.posts = posts.map((p) => this.toPostModel(p));
    return model;
  }

  async addPost(
    input: AddPostToSeriesInput,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const series = await this.seriesModel.findById(input.seriesId);
    if (!series) throw new NotFoundException('Series not found');

    const post = await this.postModel.findById(input.postId);
    if (!post) throw new NotFoundException('Post not found');

    // Only the series owner (or admin) can add posts to it
    const isOwner = series.author.toString() === requestor._id.toString();
    const isAdmin = requestor.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not own this series');
    }

    // Post must belong to the same space as the series
    if (post.space !== series.space) {
      throw new ConflictException(
        `Post space "${post.space}" does not match series space "${series.space}"`,
      );
    }

    // If already in a different series, remove from that one first
    if (post.series && post.series.toString() !== input.seriesId) {
      await this.seriesModel.updateOne(
        { _id: post.series },
        { $inc: { postCount: -1 } },
      );
    }

    const order = input.order ?? series.postCount + 1;

    post.series = series._id;
    post.seriesOrder = order;
    await post.save();

    // Only increment if this post wasn't already counted in this series
    if (!post.series || post.series.toString() !== input.seriesId) {
      await this.seriesModel.updateOne(
        { _id: series._id },
        { $inc: { postCount: 1 } },
      );
    }

    await post.populate(['author', 'category']);
    return this.toPostModel(post);
  }

  async removePost(
    postId: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    if (!post.series) {
      throw new ConflictException('Post is not part of any series');
    }

    const series = await this.seriesModel.findById(post.series);
    if (series) {
      const isOwner = series.author.toString() === requestor._id.toString();
      const isAdmin = requestor.role === UserRole.ADMIN;
      if (!isOwner && !isAdmin) {
        throw new ForbiddenException('You do not own this series');
      }

      await this.seriesModel.updateOne(
        { _id: series._id },
        { $inc: { postCount: -1 } },
      );
    }

    post.series = null;
    post.seriesOrder = null;
    await post.save();
    await post.populate(['author', 'category']);

    return this.toPostModel(post);
  }

  async remove(seriesId: string, requestor: UserDocument): Promise<boolean> {
    const series = await this.seriesModel.findById(seriesId);
    if (!series) throw new NotFoundException('Series not found');

    const isOwner = series.author.toString() === requestor._id.toString();
    const isAdmin = requestor.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not own this series');
    }

    // Unlink all posts from this series — don't delete the posts themselves
    await this.postModel.updateMany(
      { series: series._id },
      { $set: { series: null, seriesOrder: null } },
    );

    await series.deleteOne();
    return true;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toModel(doc: SeriesDocument): SeriesModel {
    const author = doc.author;
    return {
      _id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      description: doc.description,
      coverImageUrl: doc.coverImageUrl,
      author:
        author && typeof author === 'object' && '_id' in author
          ? (author as unknown as SeriesModel['author'])
          : undefined,
      space: doc.space,
      postCount: doc.postCount,
      createdAt: doc.createdAt,
    };
  }

  private toPostModel(doc: PostDocument): PostModel {
    const author = doc.author;
    const category = doc.category;
    return {
      _id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      body: doc.body,
      summary: doc.summary,
      tags: doc.tags,
      space: doc.space,
      postType: doc.postType,
      coverImageUrl: doc.coverImageUrl,
      gallery: doc.gallery,
      author:
        author && typeof author === 'object' && '_id' in author
          ? (author as unknown as PostModel['author'])
          : undefined,
      category:
        category && typeof category === 'object' && '_id' in category
          ? (category as unknown as PostModel['category'])
          : undefined,
      status: doc.status,
      readTime: doc.readTime,
      viewCount: doc.viewCount,
      bookmarksCount: doc.bookmarksCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
