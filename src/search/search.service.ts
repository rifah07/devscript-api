import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Post, PostDocument, PostStatus } from '../posts/schemas/post.schema';
import { PostModel } from '../posts/models/post.model';
import { SearchInput } from './dto/search.input';
import { SearchResult } from './models/search-result.model';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async searchPosts(input: SearchInput): Promise<SearchResult> {
    const limit = input.limit ?? 10;

    // Build the query
    const query: Record<string, unknown> = {
      // Only search published posts
      status: PostStatus.PUBLISHED,
      // MongoDB $text search — uses the text index we created in Phase 2
      $text: { $search: input.query },
    };

    if (input.tag) query['tags'] = input.tag;
    if (input.authorId) query['author'] = new Types.ObjectId(input.authorId);
    if (input.cursor) query['_id'] = { $lt: new Types.ObjectId(input.cursor) };

    const [posts, totalCount] = await Promise.all([
      this.postModel
        .find(
          query,
          // Project the text score — used for relevance sorting
          { score: { $meta: 'textScore' } },
        )
        .sort({
          // Sort by relevance score first, then by date
          score: { $meta: 'textScore' },
          createdAt: -1,
        })
        .limit(limit + 1)
        .populate('author')
        .lean()
        .exec(),
      this.postModel.countDocuments(query),
    ]);

    const hasNextPage = posts.length > limit;
    const sliced = hasNextPage ? posts.slice(0, limit) : posts;

    return {
      posts: sliced.map((p) => this.toPostModel(p)),
      totalCount,
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
    };
  }

  async getTopPosts(limit = 10): Promise<PostModel[]> {
    const posts = await this.postModel
      .find({ status: PostStatus.PUBLISHED })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit)
      .populate('author')
      .lean()
      .exec();

    return posts.map((p) => this.toPostModel(p));
  }

  async getTrendingTags(limit = 20): Promise<{ tag: string; count: number }[]> {
    // Aggregate all tags across published posts and count occurrences
    const result = await this.postModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { status: PostStatus.PUBLISHED } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return result.map((r) => ({ tag: r._id, count: r.count }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toPostModel(doc: PostDocument): PostModel {
    const author = doc.author;
    return {
      _id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      body: doc.body,
      summary: doc.summary,
      tags: doc.tags,
      author:
        author && typeof author === 'object' && '_id' in author
          ? (author as unknown as PostModel['author'])
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
