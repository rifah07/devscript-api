// Regression tests for the security audit (Oct 2026). Each block is one
// confirmed finding; if a test here fails, that hole is open again.
// External services are faked: no Gemini calls, no emails sent.
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/ai/ai.service';
import { EmailService } from '../src/email/email.service';
import { AuthService } from '../src/auth/auth.service';
import type { UserDocument } from '../src/users/schemas/user.schema';

describe('Security regressions (e2e)', () => {
  let app: NestExpressApplication;
  let mongod: MongoMemoryServer;
  let auth: AuthService;
  let users: Model<UserDocument>;
  const sentEmails: { to: string; html: string }[] = [];
  let ip = 0;

  const gql = (
    query: string,
    variables = {},
    token?: string,
    from = `10.1.0.${++ip}`,
  ) => {
    const r = request(app.getHttpServer())
      .post('/graphql')
      .set('x-forwarded-for', from);
    if (token) r.set('authorization', `Bearer ${token}`);
    return r.send({ query, variables });
  };
  // Registers and (unless verified: false) confirms the email directly in the
  // database, because most tests here are about something else.
  const register = async (
    email: string,
    password = 'password123',
    verified = true,
  ) => {
    const res = (
      await gql(
        `mutation($i: RegisterInput!){ register(registerInput:$i){ accessToken user { _id } } }`,
        {
          i: { email, name: 'Test User', password },
        },
      )
    ).body.data.register as { accessToken: string; user: { _id: string } };
    if (verified)
      await users.updateOne({ email }, { $set: { emailVerified: true } });
    return res;
  };
  const loginWorks = async (email: string, password: string) =>
    !!(
      await gql(
        `mutation{ login(loginInput:{email:"${email}", password:"${password}"}){ accessToken } }`,
      )
    ).body.data?.login;
  const createPublished = async (
    token: string,
    title: string,
    body = 'A body that is long enough.',
  ) => {
    const id = (
      await gql(
        `mutation($i: CreatePostInput!){ createPost(input:$i){ _id } }`,
        { i: { title, body, space: 'DEVSCRIPT' } },
        token,
      )
    ).body.data.createPost._id as string;
    await gql(
      `mutation($id: ID!){ publishPost(id:$id){ _id } }`,
      { id },
      token,
    );
    return id;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue({ embed: () => Promise.resolve(null), spend: () => true })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    // Real templates, captured instead of sent.
    jest
      .spyOn(app.get(EmailService), 'send')
      .mockImplementation(
        (p: { to: string; html: string; subject: string }) => {
          sentEmails.push(p);
          return Promise.resolve(true);
        },
      );
    auth = app.get(AuthService);
    users = app.get(getModelToken('User'));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('Google sign-in', () => {
    it('removes a password set before the inbox owner signed in with Google (pre-account takeover)', async () => {
      await register('victim@example.com', 'attacker-chosen-pass', false);
      await auth.findOrCreateGoogleUser({
        googleId: 'g-victim',
        email: 'victim@example.com',
        emailVerified: true,
        name: 'Victim',
        avatarUrl: '',
      });
      expect(
        await loginWorks('victim@example.com', 'attacker-chosen-pass'),
      ).toBe(false);
    });

    it('refuses Google profiles whose email Google has not verified', async () => {
      await expect(
        auth.findOrCreateGoogleUser({
          googleId: 'g-x',
          email: 'x@example.com',
          emailVerified: false,
          name: 'Some One',
          avatarUrl: '',
        }),
      ).rejects.toThrow();
    });

    it('only accepts a login code from the browser that started the login (login CSRF)', async () => {
      const user = await register('oauth@example.com');
      const exchange = (code: string, cookie?: string) => {
        const r = request(app.getHttpServer()).post('/auth/google/exchange');
        if (cookie) r.set('cookie', cookie);
        return r.send({ code });
      };
      const nonce = 'browser-nonce-0123456789abcdef';
      const stolen = await auth.createOAuthCode(user.user._id, nonce);
      expect((await exchange(stolen)).status).toBe(401); // victim's browser: no cookie
      const other = await auth.createOAuthCode(user.user._id, nonce);
      expect(
        (await exchange(other, 'oauth_nonce=some-other-browser-nonce-xx'))
          .status,
      ).toBe(401);
      const own = await auth.createOAuthCode(user.user._id, nonce);
      expect((await exchange(own, `oauth_nonce=${nonce}`)).status).toBe(200); // the real flow still works
    });
  });

  describe('Email verification', () => {
    const publish = async (token: string) => {
      const id = (
        await gql(
          `mutation($i: CreatePostInput!){ createPost(input:$i){ _id } }`,
          {
            i: {
              title: 'Draft',
              body: 'Drafts are allowed.',
              space: 'DEVSCRIPT',
            },
          },
          token,
        )
      ).body.data.createPost._id as string;
      return gql(
        `mutation($id: ID!){ publishPost(id:$id){ status } }`,
        { id },
        token,
      );
    };

    it('lets an unverified user write a draft but not publish, comment or use AI', async () => {
      const u = await register('fresh@example.com', 'password123', false);
      expect(
        (await publish(u.accessToken)).body.errors[0].extensions.code,
      ).toBe(403);
      const ai = await gql(
        `{ suggestTitles(draft:"anything here") { suggestions } }`,
        {},
        u.accessToken,
      );
      expect(ai.body.errors[0].extensions.code).toBe(403);
      const me = await gql(`{ me { emailVerified } }`, {}, u.accessToken);
      expect(me.body.data.me.emailVerified).toBe(false);
    });

    it('sends a link at signup that unlocks publishing, once', async () => {
      sentEmails.length = 0;
      const u = await register('confirm@example.com', 'password123', false);
      const mail = sentEmails.find((m) => m.to === 'confirm@example.com');
      const token = /verify-email\?token=([A-Za-z0-9_-]+)/.exec(
        mail?.html ?? '',
      )?.[1];
      expect(token).toBeDefined();
      expect(
        (
          await gql(`mutation($t: String!){ verifyEmail(token:$t) }`, {
            t: token,
          })
        ).body.data.verifyEmail,
      ).toBe(true);
      expect(
        (
          await gql(`mutation($t: String!){ verifyEmail(token:$t) }`, {
            t: token,
          })
        ).body.errors[0].extensions.code,
      ).toBe(401);
      expect((await publish(u.accessToken)).body.data.publishPost.status).toBe(
        'PUBLISHED',
      );
    });

    it('keeps a verified owner’s password when they later sign in with Google', async () => {
      await register('owner@example.com', 'owner-pass-123');
      await auth.findOrCreateGoogleUser({
        googleId: 'g-owner',
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        avatarUrl: '',
      });
      expect(await loginWorks('owner@example.com', 'owner-pass-123')).toBe(
        true,
      );
    });
  });

  it('escapes author-written HTML in newsletter emails', async () => {
    const author = await register('author@example.com');
    await gql(
      `mutation{ subscribeToNewsletter(input:{email:"reader@example.com", space:DEVSCRIPT}) }`,
    );
    await app
      .get(getModelToken('NewsletterSubscriber'))
      .updateOne(
        { email: 'reader@example.com' },
        { $set: { isConfirmed: true } },
      );
    sentEmails.length = 0;
    await createPublished(
      author.accessToken,
      '<a href="https://evil.example">Verify your account</a>',
    );
    const mail = sentEmails.find((m) => m.to === 'reader@example.com');
    expect(mail?.html).toContain('&lt;a href=');
    expect(mail?.html).not.toContain('<a href="https://evil.example');
  });

  it('throttles GraphQL newsletter signups like REST (5/min)', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await gql(
        `mutation{ subscribeToNewsletter(input:{email:"flood${i}@example.com", space:DEVSCRIPT}) }`,
        {},
        undefined,
        '10.2.2.2',
      );
      codes.push(r.body.errors?.[0]?.extensions?.code ?? 200);
    }
    expect(codes[5]).toBe(429);
  });

  it('throttles GraphQL comments like REST (10/min)', async () => {
    const u = await register('commenter@example.com');
    const postId = await createPublished(u.accessToken, 'Comment target');
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await gql(
        `mutation($i: CreateCommentInput!){ createComment(input:$i){ _id } }`,
        { i: { postId, body: `c${i}` } },
        u.accessToken,
        '10.3.3.3',
      );
      codes.push(r.body.errors?.[0]?.extensions?.code ?? 200);
    }
    expect(codes[10]).toBe(429);
  });

  it("does not serve an unpublished post's body through other readers' bookmarks", async () => {
    const writer = await register('writer@example.com');
    const reader = await register('reader2@example.com');
    const postId = await createPublished(
      writer.accessToken,
      'Later private',
      'SECRET-BODY-TEXT that is long enough',
    );
    await gql(
      `mutation($p: ID!){ toggleBookmark(postId:$p) }`,
      { p: postId },
      reader.accessToken,
    );
    await gql(
      `mutation{ deleteMyAccount(input:{password:"password123"}) }`,
      {},
      writer.accessToken,
    );
    const res = await gql(
      `{ myBookmarks { posts { body } } }`,
      {},
      reader.accessToken,
    );
    expect(JSON.stringify(res.body)).not.toContain('SECRET-BODY-TEXT');
  });

  it('gives a deactivated account no new tokens from its refresh cookie', async () => {
    await register('deactivated@example.com');
    const login = await gql(
      `mutation{ login(loginInput:{email:"deactivated@example.com", password:"password123"}){ accessToken } }`,
    );
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    await users.updateOne(
      { email: 'deactivated@example.com' },
      { $set: { isActive: false } },
    );
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('rejects oversized uploads before buffering them (413)', async () => {
    const u = await register('uploader@example.com');
    const res = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('authorization', `Bearer ${u.accessToken}`)
      .attach('file', Buffer.alloc(6 * 1024 * 1024, 0xff), {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(413);
  });
});
