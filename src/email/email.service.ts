import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeXml } from '../common/utils/xml-escape.util';
interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Every value placed into email HTML is escaped: post titles and messages
// are user-written, and unescaped they'd let an author inject links or
// markup into emails sent from this site's address.
const h = (value: string | number): string => escapeXml(String(value));

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly sender: { email: string; name: string };

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('email.brevoApiKey');
    this.sender = {
      email: configService.get<string>('email.fromAddress') ?? '',
      name: configService.get<string>('email.fromName') ?? 'DevScript',
    };
  }

  // Never throws: a bounced email must not fail a publish or a signup.
  async send(params: SendEmailParams): Promise<boolean> {
    if (!this.apiKey) {
      // Locally the body is printed so you can click reset links. Never in
      // production: those links are credentials and logs are not private.
      this.logger.log(
        `[email not sent: no BREVO_API_KEY] to=${params.to} subject="${params.subject}"` +
          (process.env.NODE_ENV === 'production' ? '' : `\n${params.html}`),
      );
      return false;
    }
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}`, error);
      return false;
    }
  }

  // ─── Templates ─────────────────────────────────────────────────────────────

  async sendVerificationEmail(
    to: string,
    siteName: string,
    verifyUrl: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Confirm your email for ${siteName}`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px;">One click to confirm</h2>
        <p>Welcome to ${h(siteName)}. Confirm this is your email address and you can publish, comment and use the writing assistant.</p>
        <p><a href="${h(verifyUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">Confirm my email</a></p>
        <p style="color:#666;font-size:14px;">The link works once and expires in 24 hours. If you didn't sign up, ignore this email.</p>
      `),
    });
  }

  async sendPasswordResetEmail(
    to: string,
    siteName: string,
    resetUrl: string,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Reset your ${siteName} password`,
      html: this.wrapTemplate(`
        <h2 style="margin:0 0 16px;">Reset your password</h2>
        <p>Someone asked to reset the password for your ${h(siteName)} account. If it was you, use the link below. It works once and expires in 1 hour.</p>
        <p><a href="${h(resetUrl)}" style="color:#1a1a1a;font-weight:600;">Choose a new password</a></p>
        <p style="color:#666;font-size:14px;">If you didn't ask for this, ignore this email; your password stays the same.</p>
      `),
    });
  }

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
        <p>You're one click away from receiving new posts from ${h(siteName)} directly in your inbox.</p>
        <p><a href="${h(confirmUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">Confirm Subscription</a></p>
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
        <p>Thank you for subscribing to ${h(siteName)}. You'll receive an email whenever a new post is published.</p>
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
        <h2>${h(postTitle)}</h2>
        <p>${h(postSummary)}</p>
        <p><a href="${h(postUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">Read the full post</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:12px;"><a href="${h(unsubscribeUrl)}" style="color:#999;">Unsubscribe</a> from ${h(siteName)} emails</p>
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
        <p>${h(message)}</p>
        <p><a href="${h(actionUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;">View</a></p>
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
