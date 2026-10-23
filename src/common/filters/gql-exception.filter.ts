import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { Request, Response } from 'express';

// Registered globally (APP_FILTER), so it sees both GraphQL and REST errors.
@Catch()
export class GqlExceptionFilterHandler implements GqlExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    if (exception instanceof GraphQLError) return exception;

    const { status, message } = this.describe(exception);
    // Every server fault lands in the host's logs (Vercel → Logs) with the
    // operation that hit it; client errors (4xx) would only be noise.
    if (status >= 500) {
      this.logger.error(
        `${this.where(host)} ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    if (host.getType<string>() === 'graphql') {
      return new GraphQLError(message, {
        extensions: { code: status, statusCode: status },
      });
    }

    const res = host.switchToHttp().getResponse<Response>();
    res.status(status).json({ statusCode: status, message });
  }

  private describe(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            exception.message);
      // ValidationPipe returns one message per failed constraint.
      return {
        status: exception.getStatus(),
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }

    // Mongoose throws CastError for a malformed id ("abc" as an ObjectId).
    // That is a bad request from the client, not a server fault.
    if (exception instanceof Error && exception.name === 'CastError') {
      return { status: 400, message: 'Invalid id' };
    }

    // Unknown errors: the real cause is logged in catch(), never sent. A raw
    // message can contain connection strings, file paths, or query shapes.
    const message =
      process.env.NODE_ENV !== 'production' && exception instanceof Error
        ? exception.message
        : 'Internal server error';
    return { status: 500, message };
  }

  // Path only, never the query string: reset and verify tokens travel there.
  private where(host: ArgumentsHost): string {
    if (host.getType<string>() === 'graphql') {
      return `graphql ${GqlArgumentsHost.create(host).getInfo<{ fieldName: string }>().fieldName}`;
    }
    const req = host.switchToHttp().getRequest<Request>();
    return `${req.method} ${req.path}`;
  }
}
