import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostSpace } from '../posts/schemas/post.schema';
import { toPostModel } from '../posts/utils/post.mapper';
import { publicUser } from '../users/public-user-fields';

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
      // Only search published posts, in the caller's site
      status: PostStatus.PUBLISHED,
      space: input.space,
      // MongoDB $text search — uses the text index we created in Phase 2
      $text: { $search: input.query },
    };

    if (input.tag) query['tags'] = input.tag;
    if (input.authorId) query['author'] = new Types.ObjectId(input.authorId);
    // shortcut: an _id cursor doesn't match the relevance sort, so later pages
    // can skip or repeat results; switch to offset or a score-based cursor.
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
        .select('-body -uniqueViewers')
        .limit(limit + 1)
        .populate([publicUser('author'), 'category'])
        .lean()
        .exec(),
      this.postModel.countDocuments(query),
    ]);

    const hasNextPage = posts.length > limit;
    const sliced = hasNextPage ? posts.slice(0, limit) : posts;

    return {
      posts: sliced.map((p) => toPostModel(p)),
      totalCount,
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
    };
  }

  async getTopPosts(space: PostSpace, limit = 10): Promise<PostModel[]> {
    const posts = await this.postModel
      .find({ status: PostStatus.PUBLISHED, space })
      .select('-body -uniqueViewers')
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(clamp(limit))
      .populate([publicUser('author'), 'category'])
      .lean()
      .exec();

    return posts.map((p) => toPostModel(p));
  }

  async getTrendingTags(
    space: PostSpace,
    limit = 20,
  ): Promise<{ tag: string; count: number }[]> {
    // Aggregate all tags across published posts and count occurrences
    const result = await this.postModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { status: PostStatus.PUBLISHED, space } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: clamp(limit) },
    ]);

    return result.map((r) => ({ tag: r._id, count: r.count }));
  }
}

const clamp = (limit: number) => Math.min(Math.max(limit, 1), 50);
