import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Reaction, ReactionSchema } from '../reactions/schemas/reaction.schema';
import { Bookmark, BookmarkSchema } from '../bookmarks/schemas/bookmark.schema';
import { Follow, FollowSchema } from '../follows/schemas/follow.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from '../auth/schemas/refresh-token.schema';

import { AccountService } from './account.service';
import { AccountResolver } from './account.resolver';
import { AccountController } from './account.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Reaction.name, schema: ReactionSchema },
      { name: Bookmark.name, schema: BookmarkSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
  providers: [AccountService, AccountResolver],
  controllers: [AccountController],
})
export class AccountModule {}
