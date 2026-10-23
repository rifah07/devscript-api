import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';

import { AiService } from './ai.service';
import { AiQuotaService } from './ai-quota.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostsService } from '../posts/posts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { PostType } from '../posts/schemas/post.schema';

const MAX_AI_INPUT = 8000;
// Per-IP burst limit on top of the per-user daily quota.
const WRITER_LIMIT = { default: { limit: 30, ttl: 60 * 60 * 1000 } };
const READER_LIMIT = { default: { limit: 6, ttl: 60 * 60 * 1000 } };

@ObjectType()
export class AiSuggestion {
  @Field(() => [String])
  declare suggestions: string[];
}

@Resolver()
export class AiResolver {
  constructor(
    private readonly aiService: AiService,
    private readonly quota: AiQuotaService,
    private readonly postsService: PostsService,
  ) {}

  // ─── Writer tools (logged in, counted against the user's plan) ──────────

  // Owner or admin only: this writes to the post.
  @Mutation(() => String)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @Throttle(WRITER_LIMIT)
  async generatePostSummary(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<string> {
    const post = await this.postsService.findEditable(postId, user);
    await this.quota.consume(user);
    const summary = await this.aiService.generateSummary(
      post.title,
      post.body.slice(0, MAX_AI_INPUT),
      post.postType,
    );
    if (summary) await this.postsService.updateSummary(postId, summary);
    return summary;
  }

  @Query(() => AiSuggestion)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @Throttle(WRITER_LIMIT)
  async suggestTags(
    @Args('title') title: string,
    @Args('body') body: string,
    @CurrentUser() user: UserDocument,
    @Args('postType', { type: () => PostType, nullable: true })
    postType?: PostType,
  ): Promise<AiSuggestion> {
    await this.quota.consume(user);
    return {
      suggestions: await this.aiService.suggestTags(
        title.slice(0, 200),
        body.slice(0, MAX_AI_INPUT),
        postType,
      ),
    };
  }

  @Query(() => AiSuggestion)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @Throttle(WRITER_LIMIT)
  async suggestTitles(
    @Args('draft') draft: string,
    @CurrentUser() user: UserDocument,
    @Args('postType', { type: () => PostType, nullable: true })
    postType?: PostType,
  ): Promise<AiSuggestion> {
    await this.quota.consume(user);
    return {
      suggestions: await this.aiService.suggestTitles(
        draft.slice(0, MAX_AI_INPUT),
        postType,
      ),
    };
  }

  // Editor-style feedback on a draft; never rewrites it.
  @Query(() => AiSuggestion)
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @Throttle(WRITER_LIMIT)
  async reviewDraft(
    @Args('title') title: string,
    @Args('body') body: string,
    @CurrentUser() user: UserDocument,
    @Args('postType', { type: () => PostType, nullable: true })
    postType?: PostType,
  ): Promise<AiSuggestion> {
    await this.quota.consume(user);
    return {
      suggestions: await this.aiService.reviewDraft(
        title.slice(0, 200),
        body.slice(0, MAX_AI_INPUT),
        postType,
      ),
    };
  }

  // ─── Reader tool (public, tightly throttled, cached) ────────────────────

  // Empty string = AI unavailable; the frontend shows a calm fallback.
  @Query(() => String)
  @Throttle(READER_LIMIT)
  async askPost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('question') question: string,
  ): Promise<string> {
    const q = question.trim();
    if (q.length < 3 || q.length > 300) {
      throw new BadRequestException(
        'Ask a question between 3 and 300 characters.',
      );
    }
    return this.postsService.answerQuestion(postId, q);
  }
}
