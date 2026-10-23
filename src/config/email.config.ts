import { registerAs } from '@nestjs/config';

// Brevo: free 300 emails/day, sends from a single verified address (e.g. your
// Gmail) without owning a domain. No key = emails are logged, not sent.
export default registerAs('email', () => ({
  brevoApiKey: process.env.BREVO_API_KEY,
  fromAddress: process.env.EMAIL_FROM ?? '',
  fromName: process.env.EMAIL_FROM_NAME ?? 'DevScript',
}));
