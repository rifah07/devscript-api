import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  // Runs once before all tests in this file — spins up a real, temporary
  // MongoDB instance entirely in memory, no Docker, no Atlas, no network
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Point the app at our in-memory DB instead of the real one
    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.REFRESH_TOKEN_SECRET = 'e2e-test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '30d';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  // Runs once after all tests — tears down the in-memory DB completely,
  // leaving zero trace, zero cleanup needed
  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return an access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e-test@example.com',
          name: 'E2E Test User',
          password: 'securePassword123',
        })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe('e2e-test@example.com');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should reject registration with an already-used email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e-test@example.com', // same email as above test
          name: 'Duplicate Attempt',
          password: 'anotherPassword123',
        })
        .expect(409); // ConflictException
    });

    it('should reject registration with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          name: 'Bad Email User',
          password: 'securePassword123',
        })
        .expect(400); // ValidationPipe rejects before hitting the service
    });

    it('should reject registration with a short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'shortpass@example.com',
          name: 'Short Pass User',
          password: '123', // below 8-char minimum
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e-test@example.com',
          password: 'securePassword123',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e-test@example.com',
          password: 'wrongPassword',
        })
        .expect(401);
    });

    it('should give the same generic error for wrong email AND wrong password', async () => {
      // Security check: response should not reveal WHICH part was wrong
      const wrongEmailRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'doesnotexist@example.com', password: 'anything123' });

      const wrongPasswordRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e-test@example.com', password: 'wrongPassword' });

      expect(wrongEmailRes.body.message).toBe(wrongPasswordRes.body.message);
    });
  });

  describe('Protected routes', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'e2e-test@example.com',
        password: 'securePassword123',
      });
      accessToken = res.body.accessToken;
    });

    it('should reject requests with no token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('should reject requests with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('should return the user profile with a valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('e2e-test@example.com');
    });
  });
});
