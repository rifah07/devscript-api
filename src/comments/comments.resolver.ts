import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { CommentsService } from './comments.service';
import { CommentModel } from './models/comment.model';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver(() => CommentModel)
export class CommentsResolver {
  constructor(private readonly commentsService: CommentsService) {}

  @Mutation(() => CommentModel)
  @UseGuards(JwtAuthGuard)
  async createComment(
    @Args('input') input: CreateCommentInput,
    @CurrentUser() user: UserDocument,
  ): Promise<CommentModel> {
    return this.commentsService.create(input, user);
  }

  @Query(() => [CommentModel], { name: 'comments' })
  async getComments(
    @Args('postId', { type: () => ID }) postId: string,
  ): Promise<CommentModel[]> {
    return this.commentsService.findByPost(postId);
  }

  @Mutation(() => CommentModel)
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Args('input') input: UpdateCommentInput,
    @CurrentUser() user: UserDocument,
  ): Promise<CommentModel> {
    return this.commentsService.update(input, user);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.commentsService.remove(id, user);
  }
}
