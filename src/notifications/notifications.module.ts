import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [NotificationsService, NotificationsResolver],
  controllers: [NotificationsController],
  exports: [NotificationsService], // exported so other modules can trigger notifications
})
export class NotificationsModule {}
