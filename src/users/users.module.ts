import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';

@Module({
  imports: [
    // Register this module's Mongoose models.
    // Only this module (and modules that import UsersModule) can use User model.
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService, UsersResolver],
  // Export UsersService so AuthModule can use it for login verification
  exports: [UsersService],
})
export class UsersModule {}
