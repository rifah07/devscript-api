import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { User, UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import {
  Reaction,
  ReactionDocument,
} from '../reactions/schemas/reaction.schema';
import {
  Bookmark,
  BookmarkDocument,
} from '../bookmarks/schemas/bookmark.schema';
import { Follow, FollowDocument } from '../follows/schemas/follow.schema';
import {
  Notification,
  NotificationDocument,
} from '../notifications/schemas/notification.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../auth/schemas/refresh-token.schema';
import type { UserDocument as AuthUser } from '../users/schemas/user.schema';

export interface UserDataExport {
  exportedAt: Date;
  profile: {
    name: string;
    email: string;
    bio: string;
    penName: string;
    createdAt: Date;
  };
  posts: Array<{
    title: string;
    slug: string;
    body: string;
    space: string;
    postType: string;
    status: string;
    createdAt: Date;
  }>;
  comments: Array<{
    body: string;
    postId: string;
    createdAt: Date;
  }>;
  bookmarks: Array<{ postId: string; createdAt: Date }>;
  reactions: Array<{ targetId: string; targetType: string; type: string }>;
  following: string[];
  followers: string[];
}

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
    @InjectModel(Bookmark.name)
    private readonly bookmarkModel: Model<BookmarkDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    const objectId = new Types.ObjectId(userId);

    // Run all data-gathering queries in parallel — independent of each other
    const [posts, comments, bookmarks, reactions, following, followers] =
      await Promise.all([
        this.postModel
          .find({ author: objectId })
          .select('title slug body space postType status createdAt')
          .lean()
          .exec(),
        this.commentModel
          .find({ author: objectId })
          .select('body post createdAt')
          .lean()
          .exec(),
        this.bookmarkModel
          .find({ user: objectId })
          .select('post createdAt')
          .lean()
          .exec(),
        this.reactionModel
          .find({ user: objectId })
          .select('targetId targetType type')
          .lean()
          .exec(),
        this.followModel
          .find({ follower: objectId })
          .select('following')
          .lean()
          .exec(),
        this.followModel
          .find({ following: objectId })
          .select('follower')
          .lean()
          .exec(),
      ]);

    return {
      exportedAt: new Date(),
      profile: {
        name: user.name,
        email: user.email,
        bio: user.bio,
        penName: user.penName,
        createdAt: user.createdAt,
      },
      posts: posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        body: p.body,
        space: p.space,
        postType: p.postType,
        status: p.status,
        createdAt: p.createdAt,
      })),
      comments: comments.map((c) => ({
        body: c.body,
        postId: c.post.toString(),
        createdAt: c.createdAt,
      })),
      bookmarks: bookmarks.map((b) => ({
        postId: b.post.toString(),
        createdAt: b.createdAt,
      })),
      reactions: reactions.map((r) => ({
        targetId: r.targetId.toString(),
        targetType: r.targetType,
        type: r.type,
      })),
      following: following.map((f) => f.following.toString()),
      followers: followers.map((f) => f.follower.toString()),
    };
  }

  // ─── Account deletion — orchestrates cleanup across every module ──────────

  async deleteAccount(user: AuthUser, password: string): Promise<boolean> {
    // Require password confirmation — prevents accidental or malicious
    // deletion via a stolen access token with a short remaining lifetime
    const fullUser = await this.userModel
      .findById(user._id)
      .select('+password')
      .exec();

    if (!fullUser) throw new NotFoundException('User not found');

    const isPasswordValid = await bcrypt.compare(password, fullUser.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Incorrect password — account not deleted',
      );
    }

    const userId = fullUser._id;

    // Order matters: clean up dependent data before deleting the user itself.
    // Using Promise.all where operations don't depend on each other.
    await Promise.all([
      // Sessions — remove all refresh tokens, logs the user out everywhere
      this.refreshTokenModel.deleteMany({ userId }),

      // Social graph — remove both directions of follow relationships
      this.followModel.deleteMany({
        $or: [{ follower: userId }, { following: userId }],
      }),

      // Bookmarks and reactions — purely personal, safe to hard delete
      this.bookmarkModel.deleteMany({ user: userId }),
      this.reactionModel.deleteMany({ user: userId }),

      // Notifications — both sent to them and triggered by them
      this.notificationModel.deleteMany({
        $or: [{ recipient: userId }, { actor: userId }],
      }),
    ]);

    // Comments — soft delete rather than hard delete, same pattern as Phase 3.
    // Preserves reply threads other users may have written under this user's comment.
    await this.commentModel.updateMany(
      { author: userId },
      { $set: { isDeleted: true, body: '[deleted account]' } },
    );

    // Posts — this is a judgment call. We anonymize rather than delete,
    // so the writing survives (readers who bookmarked/shared it aren't
    // hit with broken links) but it's no longer attributed to this account.
    // If you'd rather hard-delete posts on account deletion, swap this
    // for postModel.deleteMany({ author: userId }).
    await this.postModel.updateMany(
      { author: userId },
      { $set: { status: 'draft' } }, // unpublish rather than delete
    );

    // Finally, delete the user document itself
    await this.userModel.deleteOne({ _id: userId });

    return true;
  }
}
