import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { ReactionsService } from './reactions.service';
import { ReactionSummary } from './models/reaction.model';
import { ToggleReactionInput } from './dto/toggle-reaction.input';
import { ReactionTargetType } from './schemas/reaction.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver()
export class ReactionsResolver {
  constructor(private readonly reactionsService: ReactionsService) {}

  // Returns true if reaction was ADDED, false if REMOVED (toggle)
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async toggleReaction(
    @Args('input') input: ToggleReactionInput,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.reactionsService.toggle(input, user);
  }

  @Query(() => [ReactionSummary], { name: 'reactions' })
  async getReactions(
    @Args('targetId', { type: () => ID }) targetId: string,
    @Args('targetType', { type: () => ReactionTargetType })
    targetType: ReactionTargetType,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
  ): Promise<ReactionSummary[]> {
    return this.reactionsService.getSummary(targetId, targetType, userId);
  }
}
