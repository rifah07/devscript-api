import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { safeCompare } from '../utils/safe-compare.util';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  // The stock guard reads switchToHttp(), which is empty in a GraphQL context.
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const { req, res } = GqlExecutionContext.create(context).getContext<{
        req: Record<string, any>;
        res: Record<string, any>;
      }>();
      return { req, res };
    }
    return super.getRequestResponse(context);
  }

  // Requests from our own Next.js servers carry the shared secret key.
  // - Server rendering (no x-client-ip): one server, many readers → skip.
  // - Browser calls via the /api proxy: the proxy adds the reader's real IP
  //   as x-client-ip, and we rate-limit THAT. The header is only trusted
  //   when the key matches; anyone else could set it to dodge the limit.
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const { req } = this.getRequestResponse(context);
    return Promise.resolve(
      this.fromOurServer(req) && !header(req, 'x-client-ip'),
    );
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const clientIp = header(req, 'x-client-ip');
    return Promise.resolve(
      this.fromOurServer(req) && clientIp ? clientIp : (req.ip as string),
    );
  }

  private fromOurServer(req: Record<string, any>): boolean {
    return safeCompare(
      header(req, 'x-internal-key'),
      process.env.INTERNAL_API_KEY,
    );
  }

  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      'Too many requests — please slow down and try again in a moment.',
    );
  }
}

const header = (req: Record<string, any>, name: string): string | undefined => {
  const value = (req.headers as Record<string, string | string[] | undefined>)[
    name
  ];
  return Array.isArray(value) ? value[0] : value;
};
