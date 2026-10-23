import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserDocument } from '../../users/schemas/user.schema';

interface RequestWithUser {
  user?: UserDocument | null;
}

// Works for GraphQL and REST. Null when an optional guard found no token.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDocument => {
    const req =
      context.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<{
            req: RequestWithUser;
          }>().req
        : context.switchToHttp().getRequest<RequestWithUser>();
    return req.user as UserDocument;
  },
);
