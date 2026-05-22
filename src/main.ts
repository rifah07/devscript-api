import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

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
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://devscript.vercel.app']
        : '*',
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
