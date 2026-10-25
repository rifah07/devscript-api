import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { ReactionsModule } from './reactions/reactions.module';
import cloudinaryConfig from './config/cloudinary.config';
import { CommonModule } from './common/common.module';
import { FollowsModule } from './follows/follows.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import seoConfig from './config/seo.config';
import { SeoModule } from './seo/seo.module';
import { SeriesModule } from './series/series.module';
import { HealthModule } from './health/health.module';
import { AccountModule } from './account/account.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import emailConfig from './config/email.config';
import aiConfig from './config/ai.config';
import { NewsletterModule } from './newsletter/newsletter.module';
import { EmailModule } from './email/email.module';
import { validateEnv } from './config/env.validation';
import { depthLimit } from './common/graphql/depth-limit.rule';
import { GqlExceptionFilterHandler } from './common/filters/gql-exception.filter';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    // ─── Config Module ────────────────────────────────────────────────────
    // isGlobal: true means you don't have to import ConfigModule
    // in every module — it's available everywhere.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        cloudinaryConfig,
        seoConfig,
        emailConfig,
        aiConfig,
      ],
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // ─── MongoDB Connection ───────────────────────────────────────────────
    // We use async factory to read the URI from ConfigService.
    // This ensures the config module is ready before connecting.
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        // Overrides the name in the URI. Set MONGODB_DB locally so development
        // never writes to the live 'devscript' database.
        dbName: process.env.MONGODB_DB || 'devscript',
      }),
      inject: [ConfigService],
    }),

    // ─── GraphQL Module ───────────────────────────────────────────────────
    // code-first approach: we define schemas with TypeScript decorators,
    // NestJS auto-generates the schema.gql file.
    // Schema-first (writing .graphql files) is valid too, but code-first
    // gives you better TypeScript integration.
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Serverless disks are read-only: build the schema in memory in prod
      autoSchemaFile: isProd ? true : join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: !isProd,
      // Introspection hands attackers a map of every field; the frontend uses
      // the committed schema.gql for codegen instead.
      introspection: !isProd,
      // ...and "Did you mean ...?" hints would rebuild that map one guess at a time
      hideSchemaDetailsFromClientErrors: isProd,
      validationRules: [depthLimit(7)],
      // Pass the HTTP request into GraphQL context so resolvers
      // can access req.user (set by JWT guard)
      context: (ctx: Record<string, unknown>) => ctx,
    }),

    ThrottlerModule.forRoot([
      {
        // Default global limit: 60 requests per minute per IP
        // This is the SAFETY NET for every route that doesn't
        // specify its own stricter limit
        name: 'default',
        ttl: 60000, // 1 minute in milliseconds
        limit: 60,
      },
    ]),

    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    ReactionsModule,
    CommonModule,
    FollowsModule,
    NotificationsModule,
    SearchModule,
    BookmarksModule,
    AdminModule,
    CategoriesModule,
    SeoModule,
    SeriesModule,
    HealthModule,
    AccountModule,
    EmailModule,
    NewsletterModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    { provide: APP_FILTER, useClass: GqlExceptionFilterHandler },
  ],
})
export class AppModule {}
