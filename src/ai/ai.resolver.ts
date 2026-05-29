import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostsService } from '../posts/posts.service';

@ObjectType()
export class AiSuggestion {
  @Field(() => [String])
  declare suggestions: string[];
}

@Resolver()
export class AiResolver {
  constructor(
    private readonly aiService: AiService,
    private readonly postsService: PostsService,
  ) {}

  // Generate and save summary for an existing post
  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async generatePostSummary(@Args('postId') postId: string): Promise<string> {
    const post = await this.postsService.findById(postId);
    const summary = await this.aiService.generateSummary(post.title, post.body);

    if (summary) {
      await this.postsService.updateSummary(postId, summary);
    }

    return summary;
  }

  @Query(() => AiSuggestion)
  @UseGuards(JwtAuthGuard)
  async suggestTags(
    @Args('title') title: string,
    @Args('body') body: string,
  ): Promise<AiSuggestion> {
    const suggestions = await this.aiService.suggestTags(title, body);
    return { suggestions };
  }

  @Query(() => AiSuggestion)
  @UseGuards(JwtAuthGuard)
  async suggestTitles(@Args('draft') draft: string): Promise<AiSuggestion> {
    const suggestions = await this.aiService.suggestTitles(draft);
    return { suggestions };
  }
}
