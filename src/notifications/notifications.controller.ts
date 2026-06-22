import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for current user' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Notifications returned' })
  async getNotifications(
    @CurrentUser() user: UserDocument,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findForUser(
      user._id.toString(),
      cursor,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned' })
  async getUnreadCount(@CurrentUser() user: UserDocument) {
    const count = await this.notificationsService.getUnreadCount(
      user._id.toString(),
    );
    return { unreadCount: count };
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    await this.notificationsService.markAsRead(id, user._id.toString());
    return { message: 'Marked as read' };
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  async markAllAsRead(@CurrentUser() user: UserDocument) {
    await this.notificationsService.markAllAsRead(user._id.toString());
    return { message: 'All notifications marked as read' };
  }
}
