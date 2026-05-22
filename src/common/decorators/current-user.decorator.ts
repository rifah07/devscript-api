// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserDocument } from '../../users/schemas/user.schema';

interface GqlContext {
  req: {
    user?: UserDocument;
  };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDocument => {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext<GqlContext>();
    return req.user as UserDocument;
  },
);
