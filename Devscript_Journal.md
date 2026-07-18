# DevScript API — Project Journal
> AI-Powered Developer Blogging Platform
> Built with: NestJS · TypeScript · GraphQL · MongoDB · JWT · Gemini AI
> Developer: Rifah | Fresh Graduate, Jagannath University CSE 2025
> Started: May 2026

---

## 📚 Table of Contents
1. [Phase 1 — Foundation](#phase-1--foundation)
2. [Phase 2 — Posts + AI](#phase-2--posts--ai)
3. [Phase 3 — Comments + Reactions](#phase-3--comments--reactions)
4. [Phase 4 — User Profile + Avatar](#phase-4--user-profile--avatar)
5. [Phase 5 — Follow System](#phase-5--follow-system)
6. [Phase 6 — Notifications](#phase-6--notifications)
7. [Phase 7 — Search + Bookmarks + Analytics](#phase-7--search--bookmarks--analytics)
8. [Bugs Solved](#-bugs-solved)
9. [Key Concepts Learned](#-key-concepts-learned)
10. [Architecture Decisions](#-architecture-decisions)
11. [Production Checklist](#-production-checklist)

---

## Phase 1 — Foundation

### What was built
- NestJS project initialization with TypeScript strict mode
- GraphQL setup (code-first, Apollo Server v5)
- MongoDB + Mongoose connection
- Environment configuration with `@nestjs/config` and `registerAs`
- JWT Authentication (access token)
- Refresh token system with rotation
- HttpOnly cookie for refresh token storage
- Global `ValidationPipe` with `whitelist: true`
- Global `GqlExceptionFilter` for error handling
- Swagger / OpenAPI setup
- Users module
- Auth module

### New concepts learned

#### NestJS Modular Monolith
Every feature is a self-contained module with its own:
- Schema (DB shape)
- Service (business logic)
- Resolver/Controller (API interface)
- DTOs/Models (data contracts)

Modules communicate only through exported services — never direct DB access across modules.

#### Dependency Injection (DI)
NestJS creates and provides class instances automatically.
You never call `new SomeService()` — you declare it in the constructor and NestJS provides it.
```typescript
constructor(private readonly authService: AuthService) {}
```
- Providers are singletons by default
- `exports` + `imports` control what's shared between modules

#### GraphQL Code-First
Write TypeScript decorators → NestJS auto-generates `schema.gql`.
- `@ObjectType()` = response type (what you return)
- `@InputType()` = argument type (what you receive)
- `@Query()` = read operation (like GET)
- `@Mutation()` = write operation (like POST/PUT/DELETE)
- `@Field()` = expose field in GraphQL schema
- `registerEnumType()` = expose TypeScript enum to GraphQL

#### JWT Auth Flow
```
Login → accessToken (15min) in response body
      → refreshToken (30d) in HttpOnly cookie

Protected request → Authorization: Bearer <accessToken>
                  → JwtAuthGuard → JwtStrategy.validate() → req.user

Token expired → POST /auth/refresh → cookie sent automatically
             → old token deleted (rotation) → new tokens issued
```

#### Refresh Token Security
- Refresh tokens stored **hashed** (SHA-256) in MongoDB — never raw
- MongoDB TTL index auto-deletes expired tokens after 30 days
- Token rotation: each refresh token usable only ONCE
- `select: false` on password field — never returned in queries

#### HttpOnly Cookie
- JavaScript cannot read HttpOnly cookies → XSS protection
- `sameSite: 'strict'` → CSRF protection
- `secure: true` in production → HTTPS only
- Browser sends cookie automatically → seamless refresh flow

#### `declare` keyword on class properties
Used in all NestJS decorator-driven classes (schemas, DTOs, models).
```typescript
// Wrong — TypeScript complains property not initialized
email: string;

// Correct — tells TS "framework initializes this, trust me"
declare email: string;
```
`declare` emits zero JavaScript — Mongoose/NestJS initializes the value at runtime.

#### Platform-independent architecture
Never import from `express` or `fastify` directly.
Use NestJS abstractions:
- `GqlExecutionContext` for GraphQL context
- `TypedRequest` interface instead of `Express.Request`
- `context.switchToHttp().getRequest<T>()` for REST
This allows swapping Express → Fastify with zero code changes.

#### Guard override for GraphQL
```typescript
// CRITICAL: must override getRequest() for GraphQL
getRequest(context: ExecutionContext): TypedRequest {
  const gqlCtx = GqlExecutionContext.create(context);
  const gqlRequest = gqlCtx.getContext<{ req?: TypedRequest }>().req;
  if (gqlRequest) return gqlRequest; // GraphQL path
  return context.switchToHttp().getRequest<TypedRequest>(); // REST path
}
```
Without this override, `@UseGuards(JwtAuthGuard)` does nothing in resolvers.

---

## Phase 2 — Posts + AI

### What was built
- Posts module (CRUD)
- Auto slug generation from title using `slugify`
- Read time calculation (words / 200)
- Cursor-based pagination
- Compound MongoDB indexes for performance
- Text index for search
- AI module with Google Gemini API
- Auto-generate post summary
- Auto-suggest tags from content
- Title suggestions from draft

### New concepts learned

#### Cursor-based vs Offset Pagination
```
Offset (skip/limit) — WRONG for feeds:
  Page 1: skip 0, limit 10
  New post inserted → page 2 has duplicate or missing item

Cursor (last item ID) — CORRECT:
  Page 1: find where _id < cursor, limit 10
  New posts don't affect existing cursors — stable
```
`_id` is a MongoDB ObjectId which encodes creation time — monotonically increasing, perfect cursor.

#### MongoDB Indexes
```typescript
// Single field index
@Prop({ index: true })

// Compound index — filter AND sort together
PostSchema.index({ status: 1, createdAt: -1 });

// Text index — full-text search
PostSchema.index({ title: 'text', body: 'text' });

// TTL index — auto-delete after time
Schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Unique compound index — prevent duplicates
Schema.index({ user: 1, post: 1 }, { unique: true });
```

#### Thin Resolver Rule
Resolvers do only two things:
1. Call the service
2. Return the result

ALL business logic (validation, DB queries, computations) lives in services.
If you write `if/else` or DB queries in a resolver — move it to the service.

#### Gemini AI Integration
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
const result = await model.generateContent(prompt);
return result.response.text();
```
- Always wrap in try/catch — AI is a nice-to-have, never crash the app for it
- Return empty string on failure, not an error
- Limit body length sent to API to avoid token overflow
- Parse JSON responses defensively — strip markdown code fences first

#### `select: false` on sensitive fields
```typescript
@Prop({ required: true, select: false })
declare password: string;

// Must explicitly request it when needed:
await userModel.findOne({ email }).select('+password');
```

#### `lean()` for performance
```typescript
.find(query).lean().exec()
// Returns plain JS objects instead of Mongoose documents
// 2-3x faster — no hydration overhead
// Use for read-only operations
// Use .save() / .populate() only on full Mongoose documents
```

---

## Phase 3 — Comments + Reactions

### What was built
- Comments module with nested replies (1 level max)
- Soft delete for comments with replies
- Reactions module (LIKE, HELPFUL, INSPIRING, BRILLIANT, SAVED)
- Polymorphic reactions — react to posts OR comments
- Toggle reaction pattern
- Reaction summary with counts per type
- Unique index prevents duplicate reactions at DB level

### New concepts learned

#### Soft Delete Pattern
When a deleted comment has replies, hard delete breaks the thread.
```typescript
// Instead of deleteOne():
comment.isDeleted = true;
comment.body = '[deleted]';
await comment.save();
// Document stays, replies still work, thread intact
```

#### Polymorphic References
One collection can reference different collections:
```typescript
targetId: Types.ObjectId   // points to Post OR Comment
targetType: 'post' | 'comment'  // tells you which
```
Used when the same operation (reaction) applies to multiple entity types.

#### Race Condition Prevention with Unique Index
```typescript
// WRONG — two simultaneous requests both pass this check:
const existing = await model.findOne(filter);
if (!existing) await model.create(data); // race condition!

// CORRECT — DB enforces uniqueness atomically:
Schema.index({ user: 1, targetId: 1, type: 1 }, { unique: true });
// Catch error code 11000 for duplicate key
```

#### MongoDB Aggregation Pipeline
```typescript
await model.aggregate([
  { $match: { targetId, targetType } },   // filter
  { $group: { _id: '$type', count: { $sum: 1 } } }, // group + count
]);
```
Aggregations run on the DB server — much faster than fetching all docs and counting in Node.js.

---

## Phase 4 — User Profile + Avatar Upload

### What was built
- Cloudinary integration for image hosting
- Avatar upload with auto-resize (400×400, face crop)
- Post cover upload (1200×630, Open Graph ratio)
- Old avatar deletion before new upload
- Profile fields: bio, website, github, twitter
- `findByIdAndUpdate` with `$set` for partial updates
- `memoryStorage()` for Vercel-compatible file handling

### New concepts learned

#### Why Cloudinary (not MongoDB or filesystem)
```
MongoDB Base64:  bloats DB, slows queries, expensive
Filesystem:      Vercel serverless = no persistent disk
Cloudinary:      CDN-backed, auto-optimizes, free tier = 25GB
```

#### Stream upload (Buffer → Cloudinary)
```typescript
// Vercel has no filesystem — use memory storage
FileInterceptor('file', { storage: memoryStorage() })

// Convert Buffer to stream for Cloudinary upload
const readable = new Readable();
readable.push(buffer);
readable.push(null);
readable.pipe(uploadStream);
```

#### Cloudinary Transformations
```typescript
// Avatar: 400x400 square, crop from face
{ width: 400, height: 400, crop: 'fill', gravity: 'face' }

// Cover: 1200x630 (Open Graph standard ratio)
{ width: 1200, height: 630, crop: 'fill' }

// Auto-optimize quality and format
{ quality: 'auto', fetch_format: 'auto' }
```
Cloudinary converts to WebP automatically where browser supports it.

#### `findByIdAndUpdate` vs `find + save`
```typescript
// find + save — two DB round trips, full document hydration
const user = await userModel.findById(id);
user.name = newName;
await user.save();

// findByIdAndUpdate — one round trip, returns updated document
await userModel.findByIdAndUpdate(id, { $set: updates }, { new: true });
// Use { new: true } to get the updated document back
```

---

## Phase 5 — Follow System

### What was built
- Follows module with separate collection
- Follow / Unfollow with duplicate prevention
- Paginated followers list
- Paginated following list
- Follow stats (counts + isFollowing check)
- `getFollowerIds()` exported for Notifications module
- Self-follow prevention
- `Promise.all` for parallel queries

### New concepts learned

#### Separate Collection vs Arrays on User
```
Arrays on User:
  user: { followers: [id1, id2, ...10000 ids] }
  Problem: document grows unboundedly, every user fetch carries all follower IDs

Separate collection:
  follows: { follower, following, createdAt }
  Scales infinitely, easy to paginate, compound unique index
```

#### `Promise.all` for Parallel Queries
```typescript
// Sequential — 3x slower
const followersCount = await model.countDocuments(...);
const followingCount = await model.countDocuments(...);
const isFollowing = await model.exists(...);

// Parallel — same time as the slowest single query
const [followersCount, followingCount, isFollowing] = await Promise.all([
  model.countDocuments({ following: userId }),
  model.countDocuments({ follower: userId }),
  model.exists({ follower: currentUserId, following: userId }),
]);
```
Always use `Promise.all` when queries don't depend on each other.

#### MongoDB `exists()` vs `findOne()`
```typescript
// findOne — fetches entire document (wasteful for boolean check)
const doc = await model.findOne(filter); // returns full document or null
const exists = doc !== null;

// exists — just checks, returns { _id } or null
const exists = await model.exists(filter) !== null; // much faster
```

---

## Phase 6 — Notifications

### What was built
- Notifications module with 5 event types
- NEW_FOLLOWER, POST_COMMENT, COMMENT_REPLY, POST_REACTION, NEW_POST_FROM_FOLLOWING
- TTL index — auto-deletes notifications after 90 days
- Stored `message` string on creation for performance
- `insertMany` for bulk follower notifications
- Mark as read / Mark all as read
- Unread count for notification bell
- WebSocket gateway (commented out — ready for AWS deployment)
- Socket.IO with JWT authentication on connection
- User rooms for targeted push

### New concepts learned

#### DB Polling vs WebSockets
```
DB Polling (Vercel):
  Client: "any new notifications?" every 30s
  Simple, serverless-compatible, slight delay

WebSockets (AWS/VPS):
  Server pushes instantly when event happens
  Persistent connection, real-time, needs long-running server

DevScript: polling now, WebSocket ready to uncomment for AWS
```

#### Socket.IO Rooms
```typescript
// Join a room named after userId
await client.join(`user:${userId}`);

// Emit to all sockets in that room (all user's devices)
server.to(`user:${userId}`).emit('notification', data);
```
One user can have multiple connections (phone + laptop) — rooms handle all of them.

#### WebSocket JWT Authentication
```typescript
// Client connects with token
io('/notifications', { auth: { token: 'Bearer xxx' } })

// Server verifies on connection
const payload = jwtService.verify(token, { secret });
// Disconnect if invalid — no anonymous WebSocket connections
```

#### `insertMany` for bulk operations
```typescript
// One DB round trip for N documents
await model.insertMany(notifications); // much faster than N individual creates
```

#### Fire and forget pattern
```typescript
// Don't await non-critical async operations
// They run in background — don't slow down the response
void this.followsService
  .getFollowerIds(userId)
  .then((ids) => this.notificationsService.notifyNewPost(...));
```

---

## Phase 7 — Search + Bookmarks + Analytics

### What was built
- Full-text search using MongoDB `$text` index
- Relevance score sorting (`$meta: 'textScore'`)
- Trending tags aggregation
- Top posts by view count
- Post view tracking with unique viewer deduplication
- Author analytics dashboard (total views, posts, bookmarks)
- Bookmarks module with toggle pattern
- Cached `bookmarksCount` on Post document
- `$addToSet` for atomic unique array operations
- `$inc` for atomic counter increments

### New concepts learned

#### MongoDB Text Search
```typescript
// Index (defined once on schema)
PostSchema.index({ title: 'text', body: 'text' });

// Query
{ $text: { $search: 'nestjs graphql' } }

// Sort by relevance
.sort({ score: { $meta: 'textScore' } })
// Without this, results are in insertion order
```

#### Atomic Operations — `$addToSet` and `$inc`
```typescript
// $addToSet — adds to array only if not already present (atomic)
// No race condition possible
$addToSet: { uniqueViewers: userId },
$inc: { viewCount: 1 }

// $inc — atomic counter increment
// Two simultaneous requests both increment correctly
// Never: count = count + 1 (race condition)
// Always: { $inc: { count: 1 } }
```

#### Caching counts on documents
```typescript
// Instead of: SELECT COUNT(*) FROM bookmarks WHERE postId = ?  (on every read)
// Store the count on the Post document and update atomically:
$inc: { bookmarksCount: 1 }  // when bookmarked
$inc: { bookmarksCount: -1 } // when unbookmarked
// One field read vs one extra query on every post fetch
```

#### Nested populate
```typescript
.populate({
  path: 'post',          // populate the post field
  populate: { path: 'author' } // then populate post's author field
})
// Fetches: bookmark → post → post.author in one query
```

#### Aggregation for analytics
```typescript
await model.aggregate([
  { $match: { author: authorId } },
  {
    $group: {
      _id: null,
      totalViews: { $sum: '$viewCount' },
      totalPosts: { $sum: 1 },
    }
  }
]);
```

---

## 🐛 Bugs Solved

### Bug 1 — Apollo Server version conflict
**Error:** `ERESOLVE unable to resolve dependency tree`
**Cause:** `@nestjs/apollo@13` requires `@apollo/server@^5` but sub-dependency `@apollo/server-plugin-landing-page-graphql-playground` requires `^4`
**Fix:** Add `overrides` block in `package.json` to force the plugin to use the installed Apollo version
```json
"overrides": {
  "@apollo/server-plugin-landing-page-graphql-playground": {
    "@apollo/server": "$@apollo/server"
  }
}
```

### Bug 2 — NestJS v11 + `@nestjs/graphql@12` incompatibility
**Error:** `peer @nestjs/common@"^9.3.8 || ^10.0.0"` — project has v11
**Fix:** Use `@nestjs/graphql@^13` and `@nestjs/apollo@^13` which support NestJS v11

### Bug 3 — Missing `@as-integrations/express5` package
**Error:** `The "@as-integrations/express5" package is missing`
**Fix:** `npm install @as-integrations/express5` — required by `@nestjs/apollo@13` with Apollo Server v5

### Bug 4 — `HydratedDocument` not imported
**Error:** `Cannot find name 'HydratedDocument'`
**Fix:** `import { Document, HydratedDocument } from 'mongoose'`

### Bug 5 — Uninitialized class properties in strict mode
**Error:** `Property 'email' has no initializer and is not definitely assigned`
**Cause:** `strictPropertyInitialization: true` in tsconfig — TypeScript can't see Mongoose/NestJS initializing the property
**Fix:** Use `declare` keyword on all decorator-driven class properties
```typescript
declare email: string;  // not: email: string;
```
**Why `declare`:** Emits zero JavaScript — Mongoose initializes at runtime, TypeScript trusts you

### Bug 6 — JWT guard does nothing in GraphQL resolvers
**Error:** Protected resolvers accessible without token
**Cause:** Default `AuthGuard` reads from HTTP context — GraphQL has its own context
**Fix:** Override `getRequest()` to extract from GraphQL context
```typescript
getRequest(context: ExecutionContext) {
  const gqlCtx = GqlExecutionContext.create(context);
  const gqlRequest = gqlCtx.getContext<{ req?: TypedRequest }>().req;
  if (gqlRequest) return gqlRequest;
  return context.switchToHttp().getRequest<TypedRequest>();
}
```

### Bug 7 — `import type` required for decorated parameters
**Error:** `A type referenced in a decorated signature must be imported with 'import type'`
**Cause:** `isolatedModules` + `emitDecoratorMetadata` — types in decorated params must be import-type-only
**Fix:**
```typescript
import type { GqlContext } from '../common/interfaces/gql-context.interface';
import type { UserDocument } from '../users/schemas/user.schema';
// Regular imports for classes used as values:
import { AuthService } from './auth.service';
```
**Rule:** Interface/type → `import type`. Class/function/constant → regular `import`.

### Bug 8 — `cookieParser` not callable
**Error:** `Type 'typeof cookieParser' has no call signatures`
**Fix:**
```typescript
// Wrong:
import * as cookieParser from 'cookie-parser';
// Correct:
import cookieParser from 'cookie-parser';
```
Requires `esModuleInterop: true` in tsconfig (NestJS sets this by default).

### Bug 9 — `select: false` password field causes ObjectId/UserModel type mismatch
**Error:** `Type 'ObjectId' is not assignable to type 'string'`
**Cause:** Mongoose `_id` is `ObjectId` internally; GraphQL model expects `string`
**Fix:** Create a `toModel()` mapper that explicitly converts `_id.toString()`
```typescript
private toModel(doc: UserDocument): UserModel {
  return {
    _id: doc._id.toString(), // ObjectId → string
    email: doc.email,
    // ...
  };
}
```
Never cast with `as any` — always map explicitly.

### Bug 10 — `doc.populated is not a function` on lean results
**Error:** `TypeError: doc.populated is not a function`
**Cause:** `.lean()` returns plain JS objects — Mongoose methods like `.populated()` don't exist on them
**Fix:** Check type directly instead
```typescript
// Wrong (only works on Mongoose documents):
doc.populated('author')

// Correct (works on both lean and full documents):
author && typeof author === 'object' && '_id' in author
  ? author as unknown as PostModel['author']
  : undefined
```

### Bug 11 — GraphQL enum value case mismatch
**Error:** `Value "published" does not exist in "PostStatus" enum. Did you mean "PUBLISHED"?`
**Cause:** GraphQL uses enum KEY names (uppercase), not string values (lowercase)
**Fix:** Use uppercase in GraphQL queries
```graphql
# Wrong:
posts(filter: { status: published })
# Correct:
posts(filter: { status: PUBLISHED })
```
Your enum: `PUBLISHED = 'published'` → GraphQL sees `PUBLISHED`, MongoDB stores `'published'`

### Bug 12 — `JwtSignOptions` expiresIn type error
**Error:** `Type 'string' is not assignable to type 'number | StringValue | undefined'`
**Cause:** `@nestjs/jwt` uses `ms` library's strict `StringValue` type
**Fix:**
```typescript
expiresIn: (expiresIn ?? '15m') as unknown as number
```
Cast via `unknown` — runtime behavior is correct, TypeScript type definition is stricter than actual library behavior.

### Bug 13 — `@types/slugify` not found
**Error:** `404 Not Found - @types/slugify`
**Cause:** `slugify` ships its own TypeScript types — no `@types/` package exists
**Fix:** Just `npm install slugify` — types included automatically

### Bug 14 — Refresh token not sent from Apollo Sandbox
**Error:** `No refresh token provided` when calling `refreshToken` mutation
**Cause:** Apollo Sandbox runs in iframe — cross-origin restrictions prevent cookies from being sent
**Fix:** Use REST endpoint `POST /auth/refresh` or curl for testing
```bash
curl -X POST http://localhost:3000/auth/refresh -b cookies.txt -c cookies.txt
```
In production, browser handles cookies automatically — not an issue with real frontend.

### Bug 15 — `import.meta.dirname` in ESLint config
**Error:** `Property 'dirname' does not exist on type 'ImportMeta'`
**Context:** ESLint config is `.mjs` (ESM) but project outputs CommonJS
**Fix:** Use `resolve()` from `path` module — works in both CommonJS and ESM
```javascript
import { resolve } from 'path';
tsconfigRootDir: resolve(), // = process.cwd() = project root
```

### Bug 16 — `baseUrl` deprecated in TypeScript 7.0
**Error:** `Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`
**Fix:** Remove `baseUrl` from tsconfig — not needed with `moduleResolution: nodenext`

### Bug 17 — Unnecessary type assertions flagged by ESLint
**Error:** `This assertion is unnecessary since it does not change the type`
**Cause:** TypeScript already infers the correct type from Mongoose generics
**Fix:** Remove the cast — TypeScript is smarter than you think
```typescript
// Wrong:
posts.map((p) => this.toModel(p as PostDocument))
// Correct:
posts.map((p) => this.toModel(p))
```

---

## 💡 Key Concepts Learned

### NestJS Core
| Concept | What it does |
|---|---|
| `@Module()` | Declares a module with imports, providers, exports |
| `@Injectable()` | Marks class as DI-injectable (a provider) |
| `@InjectModel()` | Injects a Mongoose model into a service |
| `@UseGuards()` | Applies a guard to a route/resolver |
| `@Controller()` | Marks class as REST controller |
| `@Resolver()` | Marks class as GraphQL resolver |
| `exports: []` | Makes providers available to importing modules |
| `isGlobal: true` | Makes module available everywhere without importing |

### TypeScript Patterns
| Pattern | When to use |
|---|---|
| `declare property: Type` | Properties initialized by framework (Mongoose, NestJS) |
| `import type { X }` | Types used only in decorated parameters |
| `as unknown as T` | Bridge cast when TS can't directly verify runtime shape |
| `Promise.all([...])` | Multiple independent async operations — run in parallel |
| `void expression` | Fire and forget — don't await, don't crash if it fails |

### MongoDB Patterns
| Pattern | Use case |
|---|---|
| `$text: { $search: query }` | Full-text search |
| `$addToSet: { arr: value }` | Add to array only if not present (atomic) |
| `$inc: { count: 1 }` | Atomic counter increment |
| `{ expireAfterSeconds: 0 }` | TTL index — auto-delete at `expiresAt` |
| `{ unique: true }` | Compound unique index — prevent duplicates |
| `lean()` | Return plain objects — faster reads |
| `{ new: true }` | Return updated document from `findByIdAndUpdate` |
| `insertMany()` | Bulk insert — one DB round trip |
| `exists()` | Boolean check — faster than `findOne` |

### Security Rules
1. Never store raw tokens — always hash with SHA-256
2. Never expose password field — use `select: false`
3. Never say "user not found" — always "invalid credentials"
4. Never store tokens in localStorage — use HttpOnly cookies or memory
5. Always use `whitelist: true` on `ValidationPipe`
6. Always validate file type AND size before upload
7. Use DB-level unique indexes — not just code-level checks

---

## 🏗 Architecture Decisions

### Why Modular Monolith (not Microservices)
- Microservices add distributed system complexity before you need it
- Start modular monolith → migrate to microservices when you have scale problems
- Shopify, Stack Overflow started as monoliths

### Why Code-First GraphQL (not Schema-First)
- Write TypeScript decorators → schema auto-generated
- Better TypeScript integration
- Easier refactoring — one source of truth
- Schema-first is better for large teams with dedicated frontend devs

### Why Cursor Pagination (not Offset)
- Offset pagination breaks when new items are inserted between pages
- Cursor is stable — uses `_id` as bookmark
- Twitter, Facebook, every modern API uses cursor pagination

### Why MongoDB TTL Index (not Cron Jobs)
- TTL index: declare once, MongoDB cleans up automatically every 60 seconds
- Cron job: extra infrastructure, can fail, needs monitoring
- Used for: refresh tokens (30d), notifications (90d)

### Why Soft Delete for Comments
- Hard deleting a comment that has replies orphans the thread
- Soft delete: `isDeleted: true`, `body: '[deleted]'`
- Thread structure preserved, replies still make sense

### Why Store `bookmarksCount` on Post
- Avoids a `COUNT(*)` query on every post fetch
- Updated atomically with `$inc` on bookmark toggle
- Tradeoff: slight staleness possible vs always accurate count query

### Why `Promise.all` for Independent Queries
- Sequential: total time = sum of all query times
- Parallel: total time = slowest single query
- Use whenever queries don't depend on each other's results

### Why Separate `toModel()` Mapper
- `UserDocument` = DB shape (has password, ObjectId _id, Mongoose methods)
- `UserModel` = API shape (no password, string _id, plain object)
- Explicit mapper makes conversion intentional, type-safe, and auditable
- Never cast with `as any` — always map

---

## ✅ Production Checklist

### Before deploying to Vercel
- [ ] All secrets in `.env` — never hardcoded
- [ ] `JWT_SECRET` is long and random (32+ chars)
- [ ] `REFRESH_TOKEN_SECRET` is different from `JWT_SECRET`
- [ ] MongoDB Atlas IP whitelist configured
- [ ] `NODE_ENV=production` set
- [ ] `JWT_EXPIRES_IN=15m` (not 7d)
- [ ] Cloudinary credentials set
- [ ] Gemini API key set
- [ ] CORS origin set to your actual frontend domain
- [ ] Swagger disabled in production or behind auth
- [ ] GraphQL playground disabled in production

### Before deploying to AWS (future)
- [ ] Uncomment `NotificationsGateway` in notifications module
- [ ] Configure Nginx for WebSocket proxy headers
- [ ] Open port 3000 in Security Group
- [ ] Add Redis adapter for horizontal scaling
- [ ] Enable sticky sessions or use Redis adapter
- [ ] Set `FRONTEND_URL` env var
- [ ] Configure PM2 or systemd for process management
- [ ] Set up MongoDB replica set for transactions

---

## 📁 Final Project Structure

```
src/
  auth/
    dto/           login, register, auth-response
    guards/        jwt-auth.guard
    schemas/       refresh-token.schema
    strategies/    jwt.strategy
    auth.module, service, resolver, controller

  users/
    dto/           create-user, update-profile
    models/        user.model
    schemas/       user.schema
    users.module, service, resolver, controller

  posts/
    dto/           create, update, filter
    models/        post.model, author-analytics.model
    schemas/       post.schema
    posts.module, service, resolver, controller

  comments/
    dto/           create, update
    models/        comment.model
    schemas/       comment.schema
    comments.module, service, resolver, controller

  reactions/
    dto/           toggle-reaction
    models/        reaction.model
    schemas/       reaction.schema
    reactions.module, service, resolver, controller

  follows/
    models/        follow.model
    schemas/       follow.schema
    follows.module, service, resolver, controller

  notifications/
    models/        notification.model
    schemas/       notification.schema
    notifications.module, service, resolver, controller, gateway

  search/
    dto/           search.input
    models/        search-result.model
    search.module, service, resolver, controller

  bookmarks/
    schemas/       bookmark.schema
    bookmarks.module, service, resolver, controller

  ai/
    ai.module, service, resolver

  common/
    decorators/    current-user.decorator
    filters/       gql-exception.filter
    guards/        roles.guard
    interfaces/    gql-context, typed-request
    providers/     cloudinary.provider
    services/      upload.service
    common.module

  config/
    app.config, database.config, jwt.config, cloudinary.config

  main.ts
  app.module.ts
  schema.gql (auto-generated)
```

---

*Journal last updated: Phase 7 complete*
*Next: Phase 8*
*Alhamdulillah — keep building, keep learning 🤲*

---

## 🌙 Phase 9.5 — Platform Pivot: Multi-Space Architecture

### Decision Made
Instead of building a separate platform for personal writing (poetry, Islamic reflections),
the DevScript backend was extended to serve TWO frontends from ONE backend:

1. **DevScript** — technical blog (real name, professional, for job hunting)
2. **The Misk Journal** — personal writing space (pen name "PP", poetry + Islamic reflections)

### Why this was the right call
- Avoided rebuilding auth, uploads, comments, reactions, follows, notifications from scratch
- One backend serving two branded frontends = legitimate multi-tenant architecture
- Strong interview talking point: "I built a multi-tenant content platform with a
  single backend serving two distinct frontend experiences with different content types"

### Backend changes made
- Added `PostSpace` enum: `DEVSCRIPT` | `PERSONAL`
- Added `PostType` enum: `ARTICLE` | `POEM` | `REFLECTION` | `NOTE`
- Added image gallery schema (multi-image posts, ordered, with alt text)
- Added Open Graph metadata fields (`ogTitle`, `ogDescription`, `ogImage`) —
  for rich link previews when sharing poems to Facebook/Instagram/Pinterest
- Added `penName` field to User schema — real name for DevScript, pen name for Misk Journal
- AI prompts now adapt tone based on `postType` (technical summary vs poetic reflection)
- Search now filters by `space` — DevScript and Misk Journal never mix in results
- Lowered minimum body length (50 → 10 chars) — poems can be short
- Seeded categories for both spaces (Backend Development, Career vs Poetry, Islamic
  Reflections, Life Notes)

### Platform naming journey
Considered: Attar, Naseem, Rayhan, Sakeenah, Misk, MiskBloom, Misk Diaries, Miskal, Miskah
**Final decision: "The Misk Journal"**
- Misk (مسك) = musk, the purest and most treasured fragrance in Islamic tradition
- Ties directly to the original blog name "Fragrance of the Feelings: Alhamdulillah"
- "The" prefix gives it an established-publication feel, differentiates from Misk Foundation (Saudi youth org) in search results
- Tagline candidate: "Misk & Ink" or reuse of original subtitle "fragrance of the feelings, alhamdulillah"

### New concepts learned
- **Multi-tenancy via a discriminator field**: rather than separate databases or
  separate deployments, a single `space` field on shared documents can cleanly
  separate two products. This is called a "shared schema, filtered by tenant" pattern —
  simplest form of multi-tenancy, appropriate at this scale (single owner, not
  external customers with data isolation requirements).
- **Content-type-aware AI prompting**: the same Gemini integration adapts its prompt
  language based on `postType` — technical summarization vs poetic reflection —
  without needing separate AI services.
- **Pen name pattern**: storing both `name` (legal/professional) and `penName`
  (creative/anonymous) on one User document lets one account safely present two
  public identities depending on which space's content is being viewed. The frontend
  decides which name to display — backend just provides both.


---

## Phase 12 — Account Deletion + Data Export + Health Check

### What was built
- `/health` endpoint using `@nestjs/terminus` — pings real MongoDB connection, not just process uptime
- Data export — user can download all their account data (profile, posts, comments,
  bookmarks, reactions, follows/followers) as a JSON file
- Account deletion — password-confirmed, orchestrated cleanup across every module
- GraphQL query for export (`GraphQLJSON` scalar) + REST endpoint for actual file download
- Post scheduling module extended (from Phase 11) integrates cleanly since deletion
  doesn't need to touch scheduled posts specially — same `postModel` update path

### New concepts learned

#### Health checks should test the actual dependency, not just "is the process alive"
```typescript
// Wrong signal — process running doesn't mean the app actually works:
@Get('health') check() { return { status: 'ok' }; }

// Correct — pings the real MongoDB connection:
() => this.mongoose.pingCheck('mongodb', { timeout: 3000 })
```
If MongoDB Atlas has a network blip, a naive health check still says "healthy" while
every real request fails. `@nestjs/terminus` checks the dependency itself.

#### Data export as GraphQLJSON vs formal types
For a one-off, deeply-nested export shape (posts + comments + bookmarks + reactions
all have different fields), modeling each as a full `@ObjectType()` costs dozens of
extra classes for zero real benefit — nobody queries "just the comment body" from
an export; they want everything. `GraphQLJSON` is the pragmatic choice here:
arbitrary JSON, no field-level selection needed. Reserve formal GraphQL types for
data that's actually queried piece-by-piece elsewhere in the app.

#### File download via Content-Disposition header
```typescript
res.setHeader('Content-Type', 'application/json');
res.setHeader('Content-Disposition', `attachment; filename="export.json"`);
res.send(JSON.stringify(data, null, 2));
```
This forces the browser to save the response as a file instead of rendering it
inline — same principle used for image downloads in Phase 9's gallery feature.

#### Account deletion requires password re-confirmation
An access token can be stolen or leaked with a short remaining lifetime. Deleting
an account is irreversible, so it should require re-proving identity (password),
not just a valid session token. Same reasoning as why banking apps ask for a
password again before a destructive action, even mid-session.

#### Orchestrated cleanup across modules (no cascading deletes in MongoDB)
Unlike SQL databases with `ON DELETE CASCADE`, MongoDB has no built-in cascade.
Deleting a User document does NOT automatically clean up their posts, comments,
follows, etc. — every reference has to be cleaned up explicitly:
```typescript
await Promise.all([
  refreshTokenModel.deleteMany({ userId }),      // sessions
  followModel.deleteMany({ $or: [...] }),         // social graph both directions
  bookmarkModel.deleteMany({ user: userId }),     // personal data
  reactionModel.deleteMany({ user: userId }),
  notificationModel.deleteMany({ $or: [...] }),   // sent AND received
]);
await commentModel.updateMany({ author: userId }, { isDeleted: true }); // soft
await postModel.updateMany({ author: userId }, { status: 'draft' });   // unpublish
await userModel.deleteOne({ _id: userId }); // finally, the user itself
```
Order matters: dependent data is cleaned up BEFORE deleting the parent User document.

### 🏗 Architecture decision: Anonymize posts, don't hard-delete on account deletion
When a user deletes their account, their published posts are **unpublished**
(status → draft) rather than permanently deleted. Reasoning:
- Hard-deleting breaks every external link (Google search results, RSS
  subscribers, shared links on Pinterest/Facebook) pointing to that content
- Unpublishing removes it from public view immediately — satisfies the user's
  intent ("I don't want this visible anymore")
- Platform owner retains the choice to permanently purge later if truly required
  (e.g. legal request)
- This is the same trade-off made by Medium, Dev.to, and most mature content
  platforms — "right to be forgotten" doesn't always mean "right to break the
  entire web's links to your content," it means "right to stop it being shown"

Comments follow the same logic as Phase 3's soft-delete pattern — preserved as
`[deleted account]` rather than hard-deleted, so reply threads under a deleted
user's comment don't break for other users still in the conversation.

### Production checklist additions
- [ ] `/health` endpoint added to Vercel/uptime monitoring (UptimeRobot, Better Uptime, etc.)
- [ ] Verify data export includes everything required for GDPR-style compliance
      if EU users are ever expected
- [ ] Decide final policy: should posts be hard-deleted after some retention
      window (e.g. 30 days) instead of staying as drafts forever? Currently drafts
      persist indefinitely — may need a cleanup cron eventually