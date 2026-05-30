import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { TypedRequest } from '../../common/interfaces/typed-request.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): TypedRequest {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlRequest = gqlCtx.getContext<{ req?: TypedRequest }>().req;

    if (gqlRequest) return gqlRequest;

    return context.switchToHttp().getRequest<TypedRequest>();
  }
}
