import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import {
  NotificationModel,
  PaginatedNotifications,
} from './models/notification.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver(() => NotificationModel)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => PaginatedNotifications, { name: 'notifications' })
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @CurrentUser() user: UserDocument,
    @Args('cursor', { type: () => ID, nullable: true }) cursor?: string,
    @Args('unreadOnly', { type: () => Boolean, nullable: true })
    unreadOnly?: boolean,
  ): Promise<PaginatedNotifications> {
    return this.notificationsService.findForUser(
      user._id.toString(),
      cursor,
      unreadOnly ?? false,
    );
  }

  @Query(() => Int, { name: 'unreadNotificationsCount' })
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@CurrentUser() user: UserDocument): Promise<number> {
    return this.notificationsService.getUnreadCount(user._id.toString());
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async markNotificationRead(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.notificationsService.markAsRead(id, user._id.toString());
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async markAllNotificationsRead(
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.notificationsService.markAllAsRead(user._id.toString());
  }
}
