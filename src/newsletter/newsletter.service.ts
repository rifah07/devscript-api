import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import {
  NewsletterSubscriber,
  NewsletterSubscriberDocument,
} from './schemas/newsletter-subscriber.schema';
import { SubscribeInput } from './dto/subscribe.input';
import { PostSpace } from '../posts/schemas/post.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectModel(NewsletterSubscriber.name)
    private readonly subscriberModel: Model<NewsletterSubscriberDocument>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(input: SubscribeInput): Promise<boolean> {
    const email = input.email.toLowerCase();

    const existing = await this.subscriberModel.findOne({
      email,
      space: input.space,
    });

    if (existing) {
      if (existing.isConfirmed) {
        throw new ConflictException('This email is already subscribed');
      }
      // Already requested but never confirmed — resend the confirmation
      await this.sendConfirmationEmail(existing);
      return true;
    }

    const token = crypto.randomBytes(32).toString('hex');

    const subscriber = await this.subscriberModel.create({
      email,
      space: input.space,
      token,
      isConfirmed: false,
    });

    await this.sendConfirmationEmail(subscriber);
    return true;
  }

  async confirm(token: string): Promise<boolean> {
    const subscriber = await this.subscriberModel.findOne({ token });
    if (!subscriber) throw new NotFoundException('Invalid confirmation link');

    if (subscriber.isConfirmed) return true; // idempotent — already confirmed

    subscriber.isConfirmed = true;
    subscriber.confirmedAt = new Date();
    await subscriber.save();

    const siteName = this.getSiteName(subscriber.space);
    await this.emailService.sendWelcomeEmail(subscriber.email, siteName);

    return true;
  }

  async unsubscribe(token: string): Promise<boolean> {
    const result = await this.subscriberModel.deleteOne({ token });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Invalid unsubscribe link');
    }
    return true;
  }

  // Called by PostsService when a post is published — sends to every
  // confirmed subscriber of that space
  async notifySubscribersOfNewPost(
    space: PostSpace,
    postTitle: string,
    postSummary: string,
    postSlug: string,
  ): Promise<void> {
    const subscribers = await this.subscriberModel
      .find({ space, isConfirmed: true })
      .lean()
      .exec();

    if (subscribers.length === 0) return;

    const baseUrl = this.getBaseUrl(space);
    const siteName = this.getSiteName(space);
    const postUrl = `${baseUrl}/posts/${postSlug}`;

    // Send in small batches to avoid hammering the email API with
    // hundreds of simultaneous requests if the subscriber list grows large
    const BATCH_SIZE = 20;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map((subscriber) => {
          const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${subscriber.token}`;
          return this.emailService.sendNewPostEmail(
            subscriber.email,
            siteName,
            postTitle,
            postSummary,
            postUrl,
            unsubscribeUrl,
          );
        }),
      );
    }
  }

  async getSubscriberCount(space: PostSpace): Promise<number> {
    return this.subscriberModel.countDocuments({ space, isConfirmed: true });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async sendConfirmationEmail(
    subscriber: NewsletterSubscriberDocument,
  ): Promise<void> {
    const baseUrl = this.getBaseUrl(subscriber.space);
    const siteName = this.getSiteName(subscriber.space);
    const confirmUrl = `${baseUrl}/confirm-subscription?token=${subscriber.token}`;

    await this.emailService.sendConfirmationEmail(
      subscriber.email,
      confirmUrl,
      siteName,
    );
  }

  private getBaseUrl(space: PostSpace): string {
    return space === PostSpace.DEVSCRIPT
      ? (this.configService.get<string>('seo.devscriptUrl') ?? '')
      : (this.configService.get<string>('seo.miskJournalUrl') ?? '');
  }

  private getSiteName(space: PostSpace): string {
    const names =
      this.configService.get<Record<string, string>>('seo.siteName');
    return names?.[space] ?? 'Blog';
  }
}
