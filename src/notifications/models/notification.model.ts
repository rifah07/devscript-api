import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { NotificationType } from '../schemas/notification.schema';
import { UserModel } from '../../users/models/user.model';

registerEnumType(NotificationType, { name: 'NotificationType' });

@ObjectType()
export class NotificationModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => UserModel, { nullable: true })
  declare actor?: UserModel;

  @Field(() => NotificationType)
  declare type: NotificationType;

  @Field({ nullable: true })
  declare message: string;

  @Field(() => ID, { nullable: true })
  declare postId?: string;

  @Field(() => ID, { nullable: true })
  declare commentId?: string;

  @Field()
  declare isRead: boolean;

  @Field()
  declare createdAt: Date;
}

@ObjectType()
export class PaginatedNotifications {
  @Field(() => [NotificationModel])
  declare notifications: NotificationModel[];

  @Field({ nullable: true })
  declare nextCursor?: string;

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Int)
  declare totalCount: number;

  // Unread count - for the notification bell badge
  @Field(() => Int)
  declare unreadCount: number;
}
