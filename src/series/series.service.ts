import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import { toPostModel } from '../posts/utils/post.mapper';
import { publicUser } from '../users/public-user-fields';

import { Series, SeriesDocument } from './schemas/series.schema';
import { SeriesModel } from './models/series.model';
import { CreateSeriesInput } from './dto/create-series.input';
import { AddPostToSeriesInput } from './dto/add-post-to-series.input';
import { Post, PostDocument, PostStatus } from '../posts/schemas/post.schema';
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

    await series.populate(publicUser('author'));
    return this.toModel(series);
  }

  async findAllByAuthor(authorId: string): Promise<SeriesModel[]> {
    const series = await this.seriesModel
      .find({ author: new Types.ObjectId(authorId) })
      .populate(publicUser('author'))
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return series.map((s) => this.toModel(s));
  }

  async findBySlug(slug: string): Promise<SeriesModel> {
    const series = await this.seriesModel
      .findOne({ slug })
      .populate(publicUser('author'))
      .lean()
      .exec();

    if (!series) throw new NotFoundException('Series not found');

    // Fetch posts in this series, ordered. Published only: a public series
    // page must not reveal drafts.
    const posts = await this.postModel
      .find({ series: series._id, status: PostStatus.PUBLISHED })
      .select('-body -uniqueViewers')
      .populate(publicUser('author'))
      .populate('category')
      .sort({ seriesOrder: 1 })
      .lean()
      .exec();

    const model = this.toModel(series);
    model.posts = posts.map((p) => toPostModel(p));
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

    // Requestor must own BOTH the series and the post (or be admin),
    // otherwise anyone could pull someone else's post into their series.
    const isAdmin = requestor.role === UserRole.ADMIN;
    const ownsSeries = series.author.toString() === requestor._id.toString();
    const ownsPost = post.author.toString() === requestor._id.toString();
    if (!isAdmin && !(ownsSeries && ownsPost)) {
      throw new ForbiddenException(
        'You can only add your own posts to your own series',
      );
    }

    // Post must belong to the same space as the series
    if (post.space !== series.space) {
      throw new ConflictException(
        `Post space "${post.space}" does not match series space "${series.space}"`,
      );
    }

    // Decide BEFORE reassigning post.series. The old code checked after the
    // assignment, when the answer was always "already in it": postCount
    // never went up.
    const wasInThisSeries = post.series?.toString() === input.seriesId;
    const previousSeries = post.series && !wasInThisSeries ? post.series : null;

    post.series = series._id;
    post.seriesOrder =
      input.order ??
      (wasInThisSeries ? post.seriesOrder : series.postCount + 1);
    await post.save();

    if (previousSeries) {
      await this.seriesModel.updateOne(
        { _id: previousSeries },
        { $inc: { postCount: -1 } },
      );
    }
    if (!wasInThisSeries) {
      await this.seriesModel.updateOne(
        { _id: series._id },
        { $inc: { postCount: 1 } },
      );
    }

    await post.populate([publicUser('author'), 'category']);
    return toPostModel(post);
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
    await post.populate([publicUser('author'), 'category']);

    return toPostModel(post);
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
}
