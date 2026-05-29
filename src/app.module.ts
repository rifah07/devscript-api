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
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    // ─── Config Module ────────────────────────────────────────────────────
    // isGlobal: true means you don't have to import ConfigModule
    // in every module — it's available everywhere.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),

    // ─── MongoDB Connection ───────────────────────────────────────────────
    // We use async factory to read the URI from ConfigService.
    // This ensures the config module is ready before connecting.
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        // These options prevent deprecation warnings:
        dbName: 'devscript',
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
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      // Pass the HTTP request into GraphQL context so resolvers
      // can access req.user (set by JWT guard)
      context: (ctx: Record<string, unknown>) => ctx,
    }),

    AuthModule,
    UsersModule,
    PostsModule,
    AiModule,
  ],
})
export class AppModule {}
