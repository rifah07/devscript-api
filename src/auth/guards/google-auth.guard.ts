import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { newNonce, OAUTH_NONCE_COOKIE } from '../oauth-state';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // Login start (no ?code yet): remember a random nonce in an HttpOnly
  // cookie on the site's domain (the request arrives through the site's
  // /api proxy) and send the same nonce to Google inside `state`.
  // The site part is allowlisted: never echo arbitrary input into a redirect.
  getAuthenticateOptions(context: ExecutionContext) {
    const http = context.switchToHttp();
    const req = http.getRequest<{ query: { state?: string; code?: string } }>();
    if (req.query.code) return {}; // Google's callback: state is checked by the controller

    const site = req.query.state === 'personal' ? 'personal' : 'devscript';
    const nonce = newNonce();
    http.getResponse<Response>().cookie(OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    return { state: `${site}.${nonce}` };
  }
}
