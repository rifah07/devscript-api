import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

@Catch()
export class GqlExceptionFilterHandler implements GqlExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost): GraphQLError {
    // Handle NestJS HTTP exceptions (ConflictException, UnauthorizedException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? exception.message);

      return new GraphQLError(message, {
        extensions: {
          code: status,
          statusCode: status,
        },
      });
    }

    // Handle GraphQLError passthrough (already formatted)
    if (exception instanceof GraphQLError) {
      return exception;
    }

    // Handle unknown errors — NEVER leak internal details in production.
    // A raw exception.message could contain DB connection strings, file
    // paths, or other internals an attacker could use to map your system.
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    return new GraphQLError(message, {
      extensions: {
        code: 500,
        statusCode: 500,
      },
    });
  }
}
