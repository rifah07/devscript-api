import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Helmet sets ~15 security-related HTTP headers in one call.
  // Must come early in the middleware chain — before routes are registered.
  app.use(
    helmet({
      // Content-Security-Policy needs custom config because Apollo Sandbox
      // (GraphQL playground) needs to load its own scripts/styles.
      // Without this override, Helmet's strict default CSP would break
      // the GraphQL playground UI in development.
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? undefined // use Helmet's strict defaults in production
          : false, // disable CSP in dev so Apollo Sandbox works freely
    }),
  );

  // ─── Global Validation Pipe ─────────────────────────────────────────────
  // This enables class-validator decorators on ALL DTOs globally.
  // whitelist: strips unknown properties from requests (security!)
  // forbidNonWhitelisted: throws error if unknown props are sent
  // transform: auto-converts types (e.g. string "3" → number 3)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ): void => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins =
        process.env.NODE_ENV === 'production'
          ? [
              process.env.DEVSCRIPT_URL ?? 'https://devscript.com',
              process.env.MISK_JOURNAL_URL ?? 'https://themiskjournal.com',
            ]
          : ['http://localhost:3000', 'http://localhost:5173'];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  // ─── Swagger / OpenAPI ───────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevScript API')
    .setDescription('AI-Powered Developer Blogging Platform')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DevScript API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`GraphQL playground: http://localhost:${port}/graphql`);
}
bootstrap();
