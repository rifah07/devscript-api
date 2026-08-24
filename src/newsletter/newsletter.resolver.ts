import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { NewsletterService } from './newsletter.service';
import { SubscribeInput } from './dto/subscribe.input';
import { PostSpace } from '../posts/schemas/post.schema';

@Resolver()
export class NewsletterResolver {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Mutation(() => Boolean)
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
