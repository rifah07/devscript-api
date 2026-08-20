import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    if (!apiKey) throw new Error('RESEND_API_KEY is not defined');

    this.resend = new Resend(apiKey);
    this.fromAddress =
      this.configService.get<string>('email.fromAddress') ??
      'noreply@devscript.com';
  }

  async send(params: SendEmailParams): Promise<boolean> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      return true;
    } catch (error) {
      // Email failures should NEVER crash the calling operation
      // (e.g. publishing a post shouldn't fail just because one
      // subscriber's email bounced). Log and move on.
      this.logger.error(`Failed to send email to ${params.to}`, error);
      return false;
    }
  }

  // ─── Templates ─────────────────────────────────────────────────────────────

  async sendConfirmationEmail(
    to: string,
    confirmUrl: string,
    siteName: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Confirm your subscription to ${siteName}`,
      html: this.wrapTemplate(`
        <h2>Confirm your subscription</h2>
        <p>You're one click away from receiving new posts from ${siteName} directly in your inbox.</p>
        <p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">Confirm Subscription</a></p>
        <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      `),
    });
  }

  async sendWelcomeEmail(to: string, siteName: string): Promise<boolean> {
    return this.send({
      to,
      subject: `Welcome to ${siteName}`,
      html: this.wrapTemplate(`
        <h2>You're subscribed!</h2>
        <p>Thank you for subscribing to ${siteName}. You'll receive an email whenever a new post is published.</p>
      `),
    });
  }

  async sendNewPostEmail(
    to: string,
    siteName: string,
    postTitle: string,
    postSummary: string,
    postUrl: string,
    unsubscribeUrl: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `New on ${siteName}: ${postTitle}`,
      html: this.wrapTemplate(`
        <h2>${postTitle}</h2>
        <p>${postSummary}</p>
        <p><a href="${postUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">Read the full post</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:12px;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from ${siteName} emails</p>
      `),
    });
  }

  async sendNotificationEmail(
    to: string,
    message: string,
    actionUrl: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: message,
      html: this.wrapTemplate(`
        <p>${message}</p>
        <p><a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">View</a></p>
      `),
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private wrapTemplate(bodyHtml: string): string {
    return `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;line-height:1.6;">
        ${bodyHtml}
      </div>
    `;
  }
}
