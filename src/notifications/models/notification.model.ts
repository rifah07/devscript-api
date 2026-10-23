import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { NotificationType } from '../schemas/notification.schema';
import { PublicUserModel } from '../../users/models/public-user.model';
import { PostSpace } from '../../posts/schemas/post.schema';

registerEnumType(NotificationType, { name: 'NotificationType' });

@ObjectType()
export class NotificationModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => PublicUserModel, { nullable: true })
  declare actor?: PublicUserModel;

  @Field(() => NotificationType)
  declare type: NotificationType;

  @Field({ nullable: true })
  declare message: string;

  @Field(() => ID, { nullable: true })
  declare postId?: string;

  // So the frontend can link to the post, and each site can show only its
  // own space's post notifications.
  @Field({ nullable: true })
  declare postSlug?: string;

  @Field(() => PostSpace, { nullable: true })
  declare postSpace?: PostSpace;

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
