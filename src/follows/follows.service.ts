import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Follow, FollowDocument } from './schemas/follow.schema';
import { FollowStats, PaginatedUsers } from './models/follow.model';
import { UserModel } from '../users/models/user.model';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

const PAGE_SIZE = 20;

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async follow(
    targetUserId: string,
    currentUser: UserDocument,
  ): Promise<boolean> {
    // Prevent self-follow
    if (targetUserId === currentUser._id.toString()) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Verify target user exists
    await this.usersService.findById(targetUserId);

    try {
      await this.followModel.create({
        follower: currentUser._id,
        following: new Types.ObjectId(targetUserId),
      });

      // Notify the followed user
      await this.notificationsService.notifyNewFollower({
        recipient: targetUserId,
        actor: currentUser,
      });

      return true; // followed
    } catch (error: unknown) {
      // MongoDB duplicate key error code
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException('You are already following this user');
      }
      throw error;
    }
  }

  async unfollow(
    targetUserId: string,
    currentUser: UserDocument,
  ): Promise<boolean> {
    const result = await this.followModel.deleteOne({
      follower: currentUser._id,
      following: new Types.ObjectId(targetUserId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('You are not following this user');
    }

    return true; // unfollowed
  }

  async getFollowers(userId: string, cursor?: string): Promise<PaginatedUsers> {
    const query: Record<string, unknown> = {
      following: new Types.ObjectId(userId),
    };

    if (cursor) {
      query['_id'] = { $lt: new Types.ObjectId(cursor) };
    }

    const follows = await this.followModel
      .find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .populate('follower') // populate the follower user document
      .lean()
      .exec();

    const hasNextPage = follows.length > PAGE_SIZE;
    const sliced = hasNextPage ? follows.slice(0, PAGE_SIZE) : follows;
    const totalCount = await this.followModel.countDocuments({
      following: new Types.ObjectId(userId),
    });

    return {
      users: sliced
        .map((f) => f.follower as unknown as UserModel)
        .filter(Boolean),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async getFollowing(userId: string, cursor?: string): Promise<PaginatedUsers> {
    const query: Record<string, unknown> = {
      follower: new Types.ObjectId(userId),
    };

    if (cursor) {
      query['_id'] = { $lt: new Types.ObjectId(cursor) };
    }

    const follows = await this.followModel
      .find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .populate('following') // populate the following user document
      .lean()
      .exec();

    const hasNextPage = follows.length > PAGE_SIZE;
    const sliced = hasNextPage ? follows.slice(0, PAGE_SIZE) : follows;
    const totalCount = await this.followModel.countDocuments({
      follower: new Types.ObjectId(userId),
    });

    return {
      users: sliced
        .map((f) => f.following as unknown as UserModel)
        .filter(Boolean),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async getStats(userId: string, currentUserId?: string): Promise<FollowStats> {
    // Run all three queries in parallel — much faster than sequential
    const [followersCount, followingCount, isFollowingDoc] = await Promise.all([
      this.followModel.countDocuments({
        following: new Types.ObjectId(userId),
      }),
      this.followModel.countDocuments({
        follower: new Types.ObjectId(userId),
      }),
      currentUserId
        ? this.followModel.exists({
            follower: new Types.ObjectId(currentUserId),
            following: new Types.ObjectId(userId),
          })
        : Promise.resolve(null),
    ]);

    return {
      followersCount,
      followingCount,
      isFollowing: isFollowingDoc !== null,
    };
  }

  async getFollowerIds(userId: string): Promise<string[]> {
    // Used by notification system later -
    // get all follower IDs to notify when user publishes a post
    const follows = await this.followModel
      .find({ following: new Types.ObjectId(userId) })
      .select('follower')
      .lean()
      .exec();

    return follows.map((f) => f.follower.toString());
  }
}
