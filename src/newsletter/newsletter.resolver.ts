import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { NewsletterService } from './newsletter.service';
import { SubscribeInput } from './dto/subscribe.input';
import { PostSpace } from '../posts/schemas/post.schema';

@Resolver()
export class NewsletterResolver {
  constructor(private readonly newsletterService: NewsletterService) {}

  // Same limit as REST: each call emails an address someone typed in, so an
  // unthrottled mutation lets anyone use our sender to flood inboxes.
  @Mutation(() => Boolean)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async subscribeToNewsletter(
    @Args('input') input: SubscribeInput,
  ): Promise<boolean> {
    return this.newsletterService.subscribe(input);
  }

  @Mutation(() => Boolean)
  async confirmSubscription(@Args('token') token: string): Promise<boolean> {
    return this.newsletterService.confirm(token);
  }

  @Mutation(() => Boolean)
  async unsubscribeFromNewsletter(
    @Args('token') token: string,
  ): Promise<boolean> {
    return this.newsletterService.unsubscribe(token);
  }

  @Query(() => Int, { name: 'newsletterSubscriberCount' })
  async getSubscriberCount(
    @Args('space', { type: () => PostSpace }) space: PostSpace,
  ): Promise<number> {
    return this.newsletterService.getSubscriberCount(space);
  }
}
