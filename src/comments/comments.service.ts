import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Comment, CommentDocument } from './schemas/comment.schema';
import { CommentModel } from './models/comment.model';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';
import { UserRole } from '../users/schemas/user.schema';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly postsService: PostsService,
  ) {}

  async create(
    input: CreateCommentInput,
    author: UserDocument,
  ): Promise<CommentModel> {
    // If replying, validate the parent exists and is a top-level comment
    if (input.parentId) {
      const parent = await this.commentModel.findById(input.parentId);

      if (!parent) throw new NotFoundException('Parent comment not found');

      // Prevent replies to replies - enforce 1 level max
      if (parent.parent) {
        throw new BadRequestException(
          'Cannot reply to a reply. Only one level of nesting allowed',
        );
      }

      // Ensure parent belongs to the same post
      if (parent.post.toString() !== input.postId) {
        throw new BadRequestException(
          'Parent comment does not belong to this post',
        );
      }
    }

    const comment = await this.commentModel.create({
      body: input.body,
      author: author._id,
      post: new Types.ObjectId(input.postId),
      parent: input.parentId ? new Types.ObjectId(input.parentId) : null,
    });

    await comment.populate('author');
    const result = this.toModel(comment);

    // Notify post author or parent comment author
    if (input.parentId) {
      // This is a reply - notify parent comment author
      const parent = await this.commentModel.findById(input.parentId);
      if (parent) {
        void this.notificationsService.notifyCommentReply({
          recipient: parent.author.toString(),
          actor: author,
          postId: input.postId,
          commentId: comment._id.toString(),
          postTitle: '',
        });
      }
    } else {
      // Top-level comment notify post author
      const post = await this.postsService.findById(input.postId);
      if (post?.author) {
        void this.notificationsService.notifyPostComment({
          recipient: post.author._id,
          actor: author,
          postId: input.postId,
          commentId: comment._id.toString(),
          postTitle: post.title,
        });
      }
    }
    return result;
  }

  async findByPost(postId: string): Promise<CommentModel[]> {
    // Fetch all comments for a post in one query
    const comments = await this.commentModel
      .find({ post: new Types.ObjectId(postId) })
      .populate('author')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    // Separate top-level and replies in memory - faster than two DB queries
    const topLevel = comments.filter((c) => !c.parent);
    const replies = comments.filter((c) => c.parent);

    // Attach replies to their parent
    return topLevel.map((comment) => {
      const model = this.toModel(comment);
      model.replies = replies
        .filter((r) => r.parent?.toString() === comment._id.toString())
        .map((r) => this.toModel(r));
      return model;
    });
  }

  async update(
    input: UpdateCommentInput,
    requestor: UserDocument,
  ): Promise<CommentModel> {
    const comment = await this.commentModel.findById(input.id);

    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.isDeleted)
      throw new BadRequestException('Cannot edit a deleted comment');

    this.assertIsAuthor(comment, requestor);

    comment.body = input.body;
    await comment.save();
    await comment.populate('author');
    return this.toModel(comment);
  }

  async remove(id: string, requestor: UserDocument): Promise<boolean> {
    const comment = await this.commentModel.findById(id);

    if (!comment) throw new NotFoundException('Comment not found');

    const isAuthor = comment.author.toString() === requestor._id.toString();
    const isAdmin = requestor.role === UserRole.ADMIN;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Check if this comment has replies
    const hasReplies = await this.commentModel.exists({
      parent: comment._id,
    });

    if (hasReplies) {
      // Soft delete - preserve thread structure
      comment.isDeleted = true;
      comment.body = '[deleted]';
      await comment.save();
    } else {
      // Hard delete - no replies, safe to remove
      await comment.deleteOne();
    }

    return true;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertIsAuthor(comment: CommentDocument, user: UserDocument): void {
    if (comment.author.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only edit your own comments');
    }
  }

  private toModel(doc: CommentDocument): CommentModel {
    const author = doc.author;
    return {
      _id: doc._id.toString(),
      body: doc.body,
      author:
        author && typeof author === 'object' && '_id' in author
          ? (author as unknown as CommentModel['author'])
          : undefined,
      post: doc.post.toString(),
      parent: doc.parent ? doc.parent.toString() : undefined,
      isDeleted: doc.isDeleted,
      createdAt: doc.createdAt,
      replies: [],
    };
  }
}
