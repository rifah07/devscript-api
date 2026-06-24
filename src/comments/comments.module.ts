import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { CommentsService } from './comments.service';
import { CommentsResolver } from './comments.resolver';
import { CommentsController } from './comments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    NotificationsModule,
    PostsModule,
  ],
  providers: [CommentsService, CommentsResolver],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}
