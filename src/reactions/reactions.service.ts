import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';

import {
  Reaction,
  ReactionDocument,
  ReactionTargetType,
} from './schemas/reaction.schema';
import { ReactionSummary } from './models/reaction.model';
import { ToggleReactionInput } from './dto/toggle-reaction.input';
import type { UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument, PostStatus } from '../posts/schemas/post.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async toggle(
    input: ToggleReactionInput,
    user: UserDocument,
  ): Promise<boolean> {
    const filter = {
      user: user._id,
      targetId: new Types.ObjectId(input.targetId),
      type: input.type,
    };

    const existing = await this.reactionModel.findOne(filter);

    if (existing) {
      // Toggle off - remove the reaction
      await existing.deleteOne();
      return false; // false = reaction removed
    }

    // Toggle on: the target must exist (and a post must be published),
    // otherwise any id would leave an orphan reaction behind.
    const isPost = input.targetType === ReactionTargetType.POST;
    const post = isPost
      ? await this.postModel
          .findOne({ _id: input.targetId, status: PostStatus.PUBLISHED })
          .select('author title')
          .lean()
      : null;
    const exists = isPost
      ? !!post
      : !!(await this.commentModel.exists({
          _id: input.targetId,
          isDeleted: false,
        }));
    if (!exists) throw new NotFoundException('Target not found');

    await this.reactionModel.create({
      ...filter,
      targetType: input.targetType,
    });

    // Tell the author someone appreciated their post (never yourself).
    if (post) {
      await this.notificationsService
        .notifyPostReaction({
          recipient: post.author.toString(),
          actor: user,
          postId: input.targetId,
          postTitle: post.title,
        })
        .catch(() => undefined);
    }

    return true; // true = reaction added
  }

  async getSummary(
    targetId: string,
    targetType: ReactionTargetType,
    currentUserId?: string,
  ): Promise<ReactionSummary[]> {
    // Aggregate reaction counts grouped by type - one DB round trip
    const counts = await this.reactionModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          targetId: new Types.ObjectId(targetId),
          targetType,
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Which types did the current user react with?
    const userReactions: string[] = currentUserId
      ? await this.reactionModel
          .find({
            user: new Types.ObjectId(currentUserId),
            targetId: new Types.ObjectId(targetId),
          })
          .distinct('type')
      : [];

    return counts.map((c) => ({
      type: c._id as ReactionSummary['type'],
      count: c.count,
      userReacted: userReactions.includes(c._id),
    }));
  }

  async getReactionCount(targetId: string): Promise<number> {
    return this.reactionModel.countDocuments({
      targetId: new Types.ObjectId(targetId),
    });
  }
}
