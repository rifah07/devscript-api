import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { UserDocument } from '../../users/schemas/user.schema';

// Public actions (publishing, commenting, uploads, AI) need a confirmed
// email: it stops throwaway spam accounts. Use AFTER JwtAuthGuard:
//   @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req =
      context.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<{
            req: { user?: UserDocument };
          }>().req
        : context.switchToHttp().getRequest<{ user?: UserDocument }>();
    if (!req.user?.emailVerified) {
      throw new ForbiddenException(
        'Please confirm your email address first. Check your inbox, or resend the email from Settings.',
      );
    }
    return true;
  }
}
