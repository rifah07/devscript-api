import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  NEW_FOLLOWER = 'new_follower',
  POST_COMMENT = 'post_comment',
  COMMENT_REPLY = 'comment_reply',
  POST_REACTION = 'post_reaction',
  NEW_POST_FROM_FOLLOWING = 'new_post_from_following',
}

@Schema({ timestamps: true })
export class Notification {
  // Who receives this notification
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare recipient: Types.ObjectId;

  // Who triggered this notification (the actor)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  declare actor: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true })
  declare type: NotificationType;

  // Optional reference to the related entity
  @Prop({ type: Types.ObjectId, default: null })
  declare postId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  declare commentId: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  declare isRead: boolean;

  // Human-readable message — computed on creation, stored for performance
  @Prop({ required: true })
  declare message: string;

  @Prop()
  declare createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Most common query: unread notifications for a user, newest first
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Auto-delete notifications older than 90 days — keep DB clean
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
