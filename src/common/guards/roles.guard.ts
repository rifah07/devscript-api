import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../users/schemas/user.schema';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { TypedRequest } from '../interfaces/typed-request.interface';

// Metadata key — used by @Roles() decorator
export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — route is open to all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Extract user from GraphQL or HTTP context
    let user: UserDocument | undefined;

    const gqlCtx = GqlExecutionContext.create(context);
    const gqlRequest = gqlCtx.getContext<{
      req?: TypedRequest & { user?: UserDocument };
    }>().req;

    if (gqlRequest?.user) {
      user = gqlRequest.user;
    } else {
      const httpRequest = context
        .switchToHttp()
        .getRequest<TypedRequest & { user?: UserDocument }>();
      user = httpRequest.user;
    }

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
