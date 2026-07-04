import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import {
  NotificationModel,
  PaginatedNotifications,
} from './models/notification.model';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserModel } from '../users/models/user.model';

// DEPLOYMENT: Import NotificationsGateway when enabling WebSockets
// import { NotificationsGateway } from './notifications.gateway';

const PAGE_SIZE = 20;

// Payload shapes for each notification type
interface FollowPayload {
  recipient: string;
  actor: UserDocument;
}

interface CommentPayload {
  recipient: string;
  actor: UserDocument;
  postId: string;
  commentId: string;
  postTitle: string;
}

interface ReactionPayload {
  recipient: string;
  actor: UserDocument;
  postId: string;
  postTitle: string;
}

interface NewPostPayload {
  followerIds: string[];
  actor: UserDocument;
  postId: string;
  postTitle: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,

    // DEPLOYMENT (AWS STEP 1):
    // 1. Uncomment the @Optional() and gateway parameter below
    // 2. Add NotificationsGateway to providers in notifications.module.ts
    // 3. The @Optional() decorator means app still starts if gateway is absent
    //    (useful during Vercel deploys where WebSockets are disabled)
    //
    // @Optional()
    // private readonly gateway?: NotificationsGateway,
  ) {}

  // ─── Notification creators ────────────────────────────────────────────────
  // Called by other services when events happen

  async notifyNewFollower(payload: FollowPayload): Promise<void> {
    // Don't notify if user follows themselves (shouldn't happen but defensive)
    if (payload.recipient === payload.actor._id.toString()) return;

    const notification = await this.notificationModel.create({
      recipient: new Types.ObjectId(payload.recipient),
      actor: payload.actor._id,
      type: NotificationType.NEW_FOLLOWER,
      message: `${payload.actor.name} started following you`,
    });

    // DEPLOYMENT (AWS STEP 1): Uncomment to push via WebSocket
    // this.pushToUser(payload.recipient, notification);
    void notification;
  }

  async notifyPostComment(payload: CommentPayload): Promise<void> {
    // Don't notify if author comments on own post
    if (payload.recipient === payload.actor._id.toString()) return;

    const notification = await this.notificationModel.create({
      recipient: new Types.ObjectId(payload.recipient),
      actor: payload.actor._id,
      type: NotificationType.POST_COMMENT,
      postId: new Types.ObjectId(payload.postId),
      commentId: new Types.ObjectId(payload.commentId),
      message: `${payload.actor.name} commented on your post "${payload.postTitle}"`,
    });

    // DEPLOYMENT: Uncomment to push via WebSocket
    // this.pushToUser(payload.recipient, notification);
    void notification;
  }

  async notifyCommentReply(payload: CommentPayload): Promise<void> {
    if (payload.recipient === payload.actor._id.toString()) return;

    const notification = await this.notificationModel.create({
      recipient: new Types.ObjectId(payload.recipient),
      actor: payload.actor._id,
      type: NotificationType.COMMENT_REPLY,
      postId: new Types.ObjectId(payload.postId),
      commentId: new Types.ObjectId(payload.commentId),
      message: `${payload.actor.name} replied to your comment`,
    });

    // DEPLOYMENT: Uncomment to push via WebSocket
    // this.pushToUser(payload.recipient, notification);
    void notification;
  }

  async notifyPostReaction(payload: ReactionPayload): Promise<void> {
    if (payload.recipient === payload.actor._id.toString()) return;

    const notification = await this.notificationModel.create({
      recipient: new Types.ObjectId(payload.recipient),
      actor: payload.actor._id,
      type: NotificationType.POST_REACTION,
      postId: new Types.ObjectId(payload.postId),
      message: `${payload.actor.name} reacted to your post "${payload.postTitle}"`,
    });

    // DEPLOYMENT: Uncomment to push via WebSocket
    // this.pushToUser(payload.recipient, notification);
    void notification;
  }

  async notifyNewPost(payload: NewPostPayload): Promise<void> {
    if (payload.followerIds.length === 0) return;

    // Create one notification per follower — insertMany is one DB round trip
    const notifications = payload.followerIds
      .filter((id) => id !== payload.actor._id.toString())
      .map((followerId) => ({
        recipient: new Types.ObjectId(followerId),
        actor: payload.actor._id,
        type: NotificationType.NEW_POST_FROM_FOLLOWING,
        postId: new Types.ObjectId(payload.postId),
        message: `${payload.actor.name} published: "${payload.postTitle}"`,
      }));

    if (notifications.length === 0) return;

    const created = await this.notificationModel.insertMany(notifications);

    // DEPLOYMENT: Uncomment to push to all followers via WebSocket
    // created.forEach((n) => {
    //   this.pushToUser(n.recipient.toString(), n);
    // });
    void created;
  }

  // ─── Read operations ──────────────────────────────────────────────────────

  async findForUser(
    userId: string,
    cursor?: string,
    unreadOnly = false,
  ): Promise<PaginatedNotifications> {
    const query: Record<string, unknown> = {
      recipient: new Types.ObjectId(userId),
    };

    if (unreadOnly) query['isRead'] = false;
    if (cursor) query['_id'] = { $lt: new Types.ObjectId(cursor) };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ _id: -1 })
        .limit(PAGE_SIZE + 1)
        .populate('actor')
        .lean()
        .exec(),
      this.notificationModel.countDocuments({
        recipient: new Types.ObjectId(userId),
      }),
      this.notificationModel.countDocuments({
        recipient: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);

    const hasNextPage = notifications.length > PAGE_SIZE;
    const sliced = hasNextPage
      ? notifications.slice(0, PAGE_SIZE)
      : notifications;

    return {
      notifications: sliced.map((n) => this.toModel(n)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    await this.notificationModel.updateOne(
      {
        _id: new Types.ObjectId(notificationId),
        recipient: new Types.ObjectId(userId),
      },
      { $set: { isRead: true } },
    );

    // DEPLOYMENT: Push updated unread count via WebSocket
    // const count = await this.getUnreadCount(userId);
    // this.gateway?.sendUnreadCount(userId, count);

    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    await this.notificationModel.updateMany(
      {
        recipient: new Types.ObjectId(userId),
        isRead: false,
      },
      { $set: { isRead: true } },
    );

    // DEPLOYMENT: Push updated unread count via WebSocket
    // this.gateway?.sendUnreadCount(userId, 0);
    return true;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  // DEPLOYMENT: Uncomment this method when enabling WebSockets
  // Pushes notification to user in real-time AND updates their unread count
  //
  // private async pushToUser(
  //   userId: string,
  //   notification: NotificationDocument,
  // ): Promise<void> {
  //   if (!this.gateway) return; // gateway not available (Vercel)
  //
  //   this.gateway.sendNotificationToUser(userId, {
  //     _id: notification._id.toString(),
  //     type: notification.type,
  //     message: notification.message,
  //     postId: notification.postId?.toString(),
  //     commentId: notification.commentId?.toString(),
  //     createdAt: notification.createdAt,
  //   });
  //
  //   // Also push updated unread count for the bell badge
  //   const count = await this.getUnreadCount(userId);
  //   this.gateway.sendUnreadCount(userId, count);
  // }

  private toModel(doc: NotificationDocument): NotificationModel {
    const actor = doc.actor;
    return {
      _id: doc._id.toString(),
      actor:
        actor && typeof actor === 'object' && '_id' in actor
          ? (actor as unknown as UserModel)
          : undefined,
      type: doc.type,
      message: doc.message,
      postId: doc.postId?.toString(),
      commentId: doc.commentId?.toString(),
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    };
  }
}
