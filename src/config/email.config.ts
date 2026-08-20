import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  fromAddress: process.env.EMAIL_FROM ?? 'noreply@devscript.com',
}));
