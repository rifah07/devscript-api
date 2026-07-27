// ─── DEPLOYMENT NOTE ─────────────────────────────────────────────────────────
// This cron job ONLY works on traditional servers (AWS EC2, VPS, Docker) where
// the Node.js process stays running continuously.
//
// On Vercel (serverless), this file has NO EFFECT — serverless functions only
// run when triggered by a request and shut down afterward. There is no
// "always running" process for @nestjs/schedule to tick inside.
//
// FOR VERCEL: use the POST /posts/cron/publish-scheduled endpoint instead,
// triggered externally by Vercel Cron Jobs (vercel.json config) or a service
// like cron-job.org hitting that endpoint every minute.
//
// This file is safe to leave enabled even when deployed to Vercel — it just
// won't do anything there. No harm, no errors.
// ───────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostsService } from './posts.service';

@Injectable()
export class PostsCronService {
  private readonly logger = new Logger(PostsCronService.name);

  constructor(private readonly postsService: PostsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublish(): Promise<void> {
    const count = await this.postsService.publishDueScheduledPosts();

    if (count > 0) {
      this.logger.log(`Auto-published ${count} scheduled post(s)`);
    }
  }
}
