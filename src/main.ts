import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  // Behind Vercel/Render's proxy every request arrives from the proxy's IP.
  // Trusting one hop makes req.ip the real client, so rate limits are per user.
  app.set('trust proxy', 1);

  // Helmet sets ~15 security headers. CSP is off in dev so Apollo Sandbox loads.
  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // whitelist strips unknown props, forbidNonWhitelisted rejects them: blocks
  // mass assignment like sending `role: "ADMIN"` to updateProfile.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Browsers reach the API through each frontend's same-origin /api proxy, so
  // CORS only needs the two sites (and their dev ports).
  const allowedOrigins = [
    process.env.DEVSCRIPT_URL,
    process.env.MISK_JOURNAL_URL,
  ];
  if (!isProd)
    allowedOrigins.push('http://localhost:3001', 'http://localhost:3002');
  app.enableCors({
    origin: allowedOrigins.filter(Boolean) as string[],
    credentials: true,
  });

  // Swagger documents every route for attackers too, so it is dev-only.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DevScript API')
      .setDescription('AI-Powered Developer Blogging Platform')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DevScript API running on port ${port}`);
}
void bootstrap();
