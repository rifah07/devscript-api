import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Report, ReportSchema } from './schemas/report.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Reaction, ReactionSchema } from '../reactions/schemas/reaction.schema';
import { Bookmark, BookmarkSchema } from '../bookmarks/schemas/bookmark.schema';

import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import { AdminPublicResolver } from './admin.public.resolver';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Reaction.name, schema: ReactionSchema },
      { name: Bookmark.name, schema: BookmarkSchema },
    ]),
  ],
  providers: [AdminService, AdminResolver, AdminPublicResolver],
  controllers: [AdminController],
})
export class AdminModule {}
