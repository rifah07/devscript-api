import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let accessToken: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.REFRESH_TOKEN_SECRET = 'e2e-test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Register + login once, reuse the token across all tests in this file
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'writer@example.com',
        name: 'Test Writer',
        password: 'securePassword123',
      });
    accessToken = registerRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  let createdPostId: string;

  it('should create a new DevScript article', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Testing NestJS Applications',
        body: 'A comprehensive guide to writing tests for NestJS applications using Jest.',
        space: 'devscript',
        postType: 'article',
        tags: ['testing', 'nestjs'],
      })
      .expect(201);

    expect(response.body.title).toBe('Testing NestJS Applications');
    expect(response.body.slug).toMatch(/^testing-nestjs-applications-\d+$/);
    expect(response.body.status).toBe('draft'); // posts start as draft

    createdPostId = response.body._id;
  });

  it('should reject a POEM postType inside DEVSCRIPT space', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'A poem in the wrong space',
        body: 'This should be rejected by validation.',
        space: 'devscript',
        postType: 'poem', // invalid combination
      })
      .expect(400);
  });

  it('should reject creating a post without authentication', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .send({
        title: 'Unauthenticated Post',
        body: 'This should never be created.',
        space: 'devscript',
      })
      .expect(401);
  });

  it('should publish the created post', async () => {
    const response = await request(app.getHttpServer())
      .post(`/posts/${createdPostId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.status).toBe('published');
  });

  it('should retrieve the published post by slug', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/posts')
      .query({ space: 'devscript', status: 'published' })
      .expect(200);

    expect(listRes.body.posts.length).toBeGreaterThan(0);
  });
});
