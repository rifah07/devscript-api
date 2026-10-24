import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// Public routes that personalize when a token is present (e.g. show the
// author their own draft). No token or a bad token means anonymous, not 401.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
    return user || null;
  }
}
