import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Bookmark, BookmarkDocument } from './schemas/bookmark.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { PostModel, PaginatedPosts } from '../posts/models/post.model';
import type { UserDocument } from '../users/schemas/user.schema';

const PAGE_SIZE = 10;

@Injectable()
export class BookmarksService {
  constructor(
    @InjectModel(Bookmark.name)
    private readonly bookmarkModel: Model<BookmarkDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async toggle(postId: string, user: UserDocument): Promise<boolean> {
    const existing = await this.bookmarkModel.findOne({
      user: user._id,
      post: new Types.ObjectId(postId),
    });

    if (existing) {
      // Remove bookmark — decrement cached count
      await Promise.all([
        existing.deleteOne(),
        this.postModel.updateOne(
          { _id: postId },
          { $inc: { bookmarksCount: -1 } },
        ),
      ]);
      return false; // removed
    }

    // Add bookmark — increment cached count
    try {
      await Promise.all([
        this.bookmarkModel.create({
          user: user._id,
          post: new Types.ObjectId(postId),
        }),
        this.postModel.updateOne(
          { _id: postId },
          { $inc: { bookmarksCount: 1 } },
        ),
      ]);
      return true; // added
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException('Post already bookmarked');
      }
      throw error;
    }
  }

  async getUserBookmarks(
    userId: string,
    cursor?: string,
  ): Promise<PaginatedPosts> {
    const query: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
    };

    if (cursor) query['_id'] = { $lt: new Types.ObjectId(cursor) };

    const bookmarks = await this.bookmarkModel
      .find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .populate({
        path: 'post',
        populate: { path: 'author' }, // nested populate — post's author
      })
      .lean()
      .exec();

    const hasNextPage = bookmarks.length > PAGE_SIZE;
    const sliced = hasNextPage ? bookmarks.slice(0, PAGE_SIZE) : bookmarks;
    const totalCount = await this.bookmarkModel.countDocuments({
      user: new Types.ObjectId(userId),
    });

    return {
      posts: sliced
        .map((b) => b.post as unknown as PostDocument)
        .filter(Boolean)
        .map((p) => this.toPostModel(p)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async isBookmarked(postId: string, userId: string): Promise<boolean> {
    const exists = await this.bookmarkModel.exists({
      user: new Types.ObjectId(userId),
      post: new Types.ObjectId(postId),
    });
    return exists !== null;
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
