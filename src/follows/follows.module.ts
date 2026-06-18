import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Follow, FollowSchema } from './schemas/follow.schema';
import { FollowsService } from './follows.service';
import { FollowsResolver } from './follows.resolver';
import { FollowsController } from './follows.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Follow.name, schema: FollowSchema }]),
    UsersModule, // needed for UsersService.findById validation
  ],
  providers: [FollowsService, FollowsResolver],
  controllers: [FollowsController],
  exports: [FollowsService], // export for Notifications module later
})
export class FollowsModule {}
