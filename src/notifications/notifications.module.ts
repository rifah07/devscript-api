import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsController } from './notifications.controller';
// DEPLOYMENT (AWS STEP 1):
// Uncomment this import to enable WebSocket gateway
// import { NotificationsGateway } from './notifications.gateway';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    // DEPLOYMENT (AWS STEP 1):
    // JwtModule is needed by the gateway to verify tokens on WS connection.
    // Uncomment when enabling NotificationsGateway.
    //
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   useFactory: (configService: ConfigService): JwtModuleOptions => {
    //     const secret = configService.get<string>('jwt.secret');
    //     if (!secret) throw new Error('JWT_SECRET not defined');
    //     return { secret };
    //   },
    //   inject: [ConfigService],
    // }),
  ],
  providers: [
    NotificationsService,
    NotificationsResolver,
    // DEPLOYMENT (AWS STEP 1):
    // Add NotificationsGateway here to enable WebSocket support.
    // Comment out when deploying to Vercel.
    //
    // NotificationsGateway,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService], // exported so other modules can trigger notifications
})
export class NotificationsModule {}
