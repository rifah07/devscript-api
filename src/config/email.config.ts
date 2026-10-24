import { registerAs } from '@nestjs/config';

// Resend: free, no card. Until a domain is verified there, it sends only from
// onboarding@resend.dev to the account's own address. No key = emails are logged.
export default registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  fromAddress: process.env.EMAIL_FROM || 'onboarding@resend.dev',
  fromName: process.env.EMAIL_FROM_NAME ?? 'DevScript',
}));
