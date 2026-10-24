# DevScript & The Misk Journal — Project Overview

> Backend master document: what exists, how it is built, what is broken, what to build next.
> Stack: NestJS 11 · TypeScript · GraphQL (Apollo, code-first) · MongoDB/Mongoose · JWT · Gemini · Cloudinary · Resend
> Owner: Rifah — CSE, Jagannath University (2025). Last updated: October 2026.
> Companion docs: `FRONTEND_SPEC.md` (frontend build spec), `devscript-journal.md` (decision log and bug diary).
> `devscript-api-reference.md` is OUTDATED. The contract in `FRONTEND_SPEC.md` Appendix A supersedes it.

---

## 0. How to read this document

**Status legend**

| Mark | Meaning |
|---|---|
| ✅ | Built, applied to the repo, and run by the owner |
| 🟡 | Code was written in chat after the owner's last confirmed step. It may or may not be in the repo. **Tick it yourself.** |
| ⬜ | Not built |

**Confirmed state (2026-10-23):** Phase H **H1–H19 are built and verified** (unit tests, e2e tests, and an end-to-end smoke run against an in-memory MongoDB). Also fixed on the way: B1–B7, B16–B22, the REST `@CurrentUser` crash, enum `@Prop` types, the never-registered exception filter, series ownership and draft leaks, bookmark count drift, Google `state` being dropped.
Round 2 (same day): H21 cascade delete, H22 Bangla-friendly text index, H24 magic-byte upload checks and H25 reaction notifications are done; AI moved to `@google/genai` with per-user quotas, semantic related posts and "ask this article"; email on Resend (Brevo tried, then dropped); both frontends built (`devscript-web`). Deployment is fully free: see `DEPLOY.md`.
Still open: H20 email verification, H23 opt-in `totalCount`, search cursor vs relevance sort (see `DECISIONS.md`).
The BullMQ queue module exists but is not wired (V1 sends email directly).

---

## 1. Product

One backend serves **two products**, each with its own frontend, domain and brand.

| | DevScript | The Misk Journal |
|---|---|---|
| `space` enum | `DEVSCRIPT` | `PERSONAL` |
| Content | Technical articles, tutorials, career writing | Poetry, Islamic reflections, short notes |
| `postType` allowed | `ARTICLE`, `NOTE` | `POEM`, `REFLECTION`, `NOTE` |
| Body format | `markdown` | `plaintext` (line breaks are meaning) |
| Identity | Real name (job-hunting visibility) | Pen name "PP" — **separate account** |
| Tone | Precise, technical | Quiet, contemplative |
| Replaces | — | Blogspot "Fragrance of the Feelings", Pinterest and Instagram cross-posting |

**Mission:** a calm, free, ad-free, tracker-free place to write and read. For Misk, that includes people who need to write about grief, doubt and patience without exposing their identity.

**Principles (these constrain engineering decisions):**
1. Reading is always free. Tips and subscriptions, if added, never gate core content.
2. No ad tech, no third-party trackers, no selling data. Analytics are first-party and minimal.
3. Privacy claims must be real. Do not ship features that *look* anonymous but leak linkage (see S3 and the avatar note in section 9).
4. Accessibility and narration are first-class features, not extras.
5. No face emoji anywhere in the product (owner's religious preference). Reactions are text and icon only.

---

## 2. Architecture

**Style:** modular monolith. One deployable, strict module boundaries, services talk only through exported providers.
Resolvers and controllers stay thin, and business logic lives in services.

```
 Browser ─▶ Next.js app (devscript.com | misk domain)
              │  same-origin proxy  /api/* ─▶ NestJS
              ▼
        ┌──────────────────────── NestJS ────────────────────────┐
        │ Guards (JWT, OptionalJWT, Roles, Throttler)            │
        │ Pipes (ValidationPipe whitelist) · Filters (GQL, HTTP) │
        │ ┌ Auth ┐ ┌ Users ┐ ┌ Posts ┐ ┌ Comments ┐ ┌ Reactions ┐│
        │ │Follows│ │Notif. │ │Search │ │Bookmarks │ │Categories ││
        │ │Series │ │Admin  │ │  AI   │ │Newsletter│ │ SEO/RSS   ││
        │ │Account│ │Health │ │Email  │ │ Queue    │ │ Common    ││
        │ └───────┘ └───────┘ └───────┘ └──────────┘ └───────────┘│
        └──────┬─────────────┬──────────────┬─────────────┬──────┘
           MongoDB Atlas   Cloudinary     Gemini API     Resend
                                       (+ Redis for BullMQ, optional)
```

**Layering rule per module:** `schema` (DB shape) → `service` (logic) → `resolver`/`controller` (API) → `dto` (input contracts) / `model` (output contracts).
`UserDocument` (DB) and `PublicUserModel`/`UserModel` (API) are always different types, mapped explicitly with `toModel()`/`toPublicModel()`. Never `as any`.

**Dual API:** GraphQL is primary. REST mirrors most features for Swagger, curl, file downloads, cron, OAuth redirects, XML feeds.

**Platform independence:** no direct `express` imports in app code, with two documented exceptions (`Response` type for redirect and cookie calls, `trust proxy`). `TypedRequest` and `GqlContext` interfaces keep Express→Fastify a config change.

**Request lifecycle (GraphQL):**
`HTTP → helmet → cookieParser → body limit → Apollo validation (depth limit) → Guards (Throttler → JWT/OptionalJWT → Roles) → ValidationPipe (DTO) → Resolver → Service → Mongoose → toModel() → Apollo serializes only @Field() members`.

---

## 3. Tech stack and why

| Concern | Choice | Reason / trade-off |
|---|---|---|
| Framework | NestJS 11 | DI, modules, guards, opinionated structure. Heavier than Express, scales with team |
| API | GraphQL code-first (`@nestjs/graphql` 13, Apollo Server 5, `@as-integrations/express5`) | Clients ask for exactly the fields they need. Schema generated from TS. Cost: depth and complexity DoS, N+1 risk |
| DB | MongoDB Atlas + Mongoose | Flexible docs, TTL indexes, text index, aggregation. Cost: no joins/cascades, referential integrity is manual |
| Auth | JWT access (15 min, memory) + refresh (30 d, HttpOnly cookie, rotated, SHA-256 hashed in DB) + Google OAuth | XSS-resistant, revocable sessions |
| Validation | `class-validator` + `whitelist`, `forbidNonWhitelisted` | Blocks mass assignment |
| Images | Cloudinary (upload once, derive sizes by URL) | CDN, auto format/quality, face-aware crop. No serverless filesystem needed |
| AI | Google Gemini (`@google/generative-ai`) | Summaries, tags, titles, TTS narration. **SDK is legacy, see B14** |
| Email | Resend (HTTPS API) | Serverless-friendly. Needs verified domain in production |
| Queue | BullMQ + Redis (optional) | Needs a persistent worker. See section 11 |
| Realtime | Socket.IO gateway (written, disabled) | Needs persistent host. Polling is the V1 delivery |
| Security | `helmet`, `@nestjs/throttler`, strict CORS, body limits | See S-items |
| Tests | Jest + `mongodb-memory-server` + supertest | Unit with mocks, e2e against in-memory Mongo |
| Docs | Swagger/OpenAPI | **Disable or protect in production** (H16) |

---

## 4. Module catalog

### 4.1 Auth ✅
- GraphQL: `register`, `login`, `refreshToken`, `logout`, `logoutAllDevices`. 🟡 `forgotPassword`, `resetPassword`.
- REST: `/auth/register|login|refresh|logout`, `/auth/google`, `/auth/google/callback`. 🟡 `/auth/forgot-password`, `/auth/reset-password`.
- Refresh tokens: JWT signed with a separate secret, SHA-256 hash stored, single use (rotation), TTL index auto-deletes at 30 d.
- Password reset 🟡: random token hashed in DB, 1 h TTL, one active per user, always returns success (no enumeration), revokes all sessions on success.
- Google OAuth ✅ but **flawed**, see S6/H6.
- Rate limits: login 5/min, register 3/min, refresh 10/min, forgot 3/min, reset 5/min.

### 4.2 Users ✅
- `me` (private, includes email and role), `user(id)`, `updateProfile`, REST avatar upload (≤5 MB jpeg/png/webp → 400×400 face crop).
- 🟡 `PublicUserModel` split (H2). `penName` to be removed.

### 4.3 Posts ✅ (largest module)
- CRUD, publish, delete; author-or-admin authorization via `assertIsAuthorOrAdmin`.
- Cursor pagination on `_id` (`PAGE_SIZE` 10, fetch +1 to detect next page).
- `space`/`postType` validation: custom class-validator decorator and service-level defense in depth. Single source of truth in `constants/post-type-rules.ts`.
- Gallery (≤10 images): ordered subdocs `{url, publicId, width, height, alt, order, downloadCount}`.
- Image variants computed lazily by `@ResolveField` (`thumbnail`, `square`, `pinterestPin`, `landscape`, `story`, `original`), plus forced-download URLs (`fl_attachment`). Lightweight `postGallery` query for lightbox.
- Open Graph fields generated on publish.
- Scheduling ✅: status `SCHEDULED`, `scheduledAt`, `@Cron` every minute (persistent hosts) and `POST /posts/cron/publish-scheduled` with `x-cron-secret` (external cron).
- Analytics: `viewCount`, `uniqueViewers[]` (see B12), `myAnalytics` aggregation.
- Related posts: aggregation scoring (+3 same category, +1 per shared tag).
- AI narration (PERSONAL only): TTS → Cloudinary (`resource_type: video`).
- Triggers on publish: follower notifications, newsletter email, OG metadata.

### 4.4 Comments ✅
One-level replies. Soft delete when replies exist, hard delete otherwise. Top-level comments notify the post author, replies notify the parent author. Limit 10/min.

### 4.5 Reactions ✅
Polymorphic (`POST`/`COMMENT`), toggle semantics, unique compound index (race-safe), aggregation summary.
Types: `LIKE`, `HELPFUL`, `INSPIRING`, `BRILLIANT`, `SAVED`. **Text labels only, no emoji.**
Frontend should not render `SAVED`; use Bookmarks instead.

### 4.6 Follows ✅
Separate collection (no arrays on User), unique index, paginated followers/following, `followStats`, `getFollowerIds` for notification fan-out.

### 4.7 Notifications ✅ (polling) / 🟡 (WS)
Five types, message string stored at creation, TTL 90 d, unread count, mark read/all.
`NotificationsGateway` (Socket.IO, JWT-authenticated handshake, per-user rooms) is written but commented out. The AWS/VPS enable-steps are in the file header.
`notifyPostReaction` exists but is **never called** (B8).

### 4.8 Search ✅
MongoDB `$text` over title and body, relevance sort, tag/author filter. `topPosts`, `trendingTags` (aggregation).
Needs `space` scoping (H8) and language fix (H22).

### 4.9 Bookmarks ✅
Toggle, cached `bookmarksCount` on Post, paginated list with nested populate.

### 4.10 Categories ✅
Admin-curated, **space-scoped** (a poem cannot take a DevScript category). Cached `postCount`.

### 4.11 Series ✅ (with bug B5)
Ordered collections of posts (e.g. "Ramadan Reflections 2026"). Same-space enforcement.

### 4.12 Admin ✅
Role guard + decorator. Platform stats, user management (activate/deactivate/role), moderation deletes, `featurePost` (**no-op, B20**), reports workflow (`reportContent` open to any user; review is admin-only).

### 4.13 AI ✅
`generatePostSummary`, `suggestTags`, `suggestTitles` — prompts adapt by `postType`. TTS service with text prep for narration (strips markdown, line breaks → pauses, ≤3000 chars). Failures never crash the caller.
**`generatePostSummary` has no ownership check (S12).**

### 4.14 SEO ✅
`/sitemap.xml?space=`, `/rss.xml?space=`, `/robots.txt?space=` — raw XML, XML-escaped, space-scoped domains from config. Published posts only.

### 4.15 Newsletter + Email ✅
Public double opt-in (subscribe → confirm email → welcome), token-based unsubscribe, per-space lists, batch send of 20.
🟡 Revert from queue producer to direct send for V1 (H15).

### 4.16 Account ✅
Data export (JSON file), account deletion with password confirmation. Posts are **unpublished, not deleted** (anonymize-over-delete, so external links do not break). Comments soft-deleted. Sessions, follows, bookmarks, reactions, notifications purged.

### 4.17 Health ✅
`/health` pings MongoDB through Terminus.

### 4.18 Queue ✅ (producer) / 🟡 (processors)
Redis/BullMQ module with `email` and `narration` queues. See section 11 for why V1 should not depend on it.

---

## 5. Data model (collections and key indexes)

| Collection | Notable fields | Indexes |
|---|---|---|
| `users` | email, name, role, authProvider, googleId, avatarUrl/PublicId, bio, links, isActive | email unique; googleId sparse |
| `refreshtokens` | userId, tokenHash, expiresAt, userAgent | TTL(expiresAt) |
| `passwordresettokens` 🟡 | userId, tokenHash, expiresAt | TTL(expiresAt) |
| `posts` | title, slug, body, summary, tags, space, postType, status, scheduledAt, author, category, series, seriesOrder, cover*, gallery[], og*, narration*, viewCount, uniqueViewers[], bookmarksCount | slug unique; (space,status,createdAt); (space,postType,status,createdAt); (category,status,createdAt); (series,seriesOrder); (status,scheduledAt); text(title,body) |
| `comments` | body, author, post, parent, isDeleted | (post,parent,createdAt) |
| `reactions` | user, targetId, targetType, type | unique(user,targetId,type); (targetId,targetType) |
| `follows` | follower, following | unique(follower,following); both-direction indexes |
| `notifications` | recipient, actor, type, postId, commentId, message, isRead | (recipient,isRead,createdAt); TTL 90 d |
| `bookmarks` | user, post | unique(user,post) |
| `categories` | name, slug, space, description, postCount | name, slug unique |
| `series` | title, slug, author, space, postCount | slug unique |
| `reports` | reporter, targetId, targetType, reason, status, reviewedBy | unique(reporter,targetId); (status,createdAt) |
| `newslettersubscribers` | email, space, isConfirmed, token | unique(email,space); token unique |

---

## 6. Environment variables

| Var | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` enables error masking, strict CORS, disables playground/introspection |
| `PORT` | no | default 3000 |
| `MONGODB_URI` | yes | Atlas URI |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | yes | different, ≥32 random chars |
| `JWT_EXPIRES_IN` | no | `15m` in production |
| `REFRESH_TOKEN_EXPIRES_IN` | no | `30d` |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | yes | |
| `GEMINI_API_KEY` | yes | |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | verify sending domain |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | for Google login | |
| `DEVSCRIPT_URL`, `MISK_JOURNAL_URL` | yes | used for CORS, emails, sitemaps, OAuth redirects. **No safe defaults** |
| `CRON_SECRET` | yes if using external cron | |
| `INTERNAL_API_KEY` 🟡 | yes | lets Next.js server-side fetches bypass throttling (H5) |
| `REDIS_HOST/PORT/PASSWORD` | only if queue enabled | empty password OK locally |
| `FRONTEND_URL` | only if WS gateway enabled | |

Validate all of these at boot with Joi (H19). Missing secrets should crash startup, not 500 at runtime.

Dev ports: backend 3000, DevScript 3001, Misk 3002. Add both to the CORS dev allowlist and set the two `*_URL` vars accordingly.

---

## 7. Testing

**Exists ✅:** slug/readTime unit tests, `AuthService` (login branches, no password leak, JWT payload), `PostsService` authorization matrix (non-author blocked, author and admin allowed), e2e auth flow, e2e post flow, `AuthResolver` smoke test.

**Add:**
- Draft-visibility matrix (anonymous / author / other user / admin × draft / scheduled / published) — the highest-value test in the repo.
- `PublicUserModel` leak test (assert `email` and `role` absent from every public query).
- Rate-limit e2e for GraphQL (S8).
- Series count, slug immutability, gallery asset ownership.
- Contract test: snapshot `schema.gql` in CI and fail on unreviewed diffs. The frontend depends on it.

---

## 8. Phase H — hardening and contract v2 (do before frontend integration)

Priority: **P0** = fix before any public traffic · **P1** = before launch · **P2** = soon after.
"Contract" = changes the API surface the frontend consumes.

| ID | P | Contract | Task | Acceptance check |
|---|---|---|---|---|
| H1 | P0 | — | `OptionalJwtAuthGuard`; requestor-aware `findAll`, `findBySlug`, `getPostGallery`, `getRelatedPosts`. Drafts/scheduled only for author or admin. Hidden posts return **404, not 403** | Anonymous `posts(filter:{status:DRAFT})` → empty; someone else's draft slug → 404 |
| H2 | P0 | ✔ | `PublicUserModel` on every `author`/`actor`/`users[]`. `email` and `role` only on `me`, `updateProfile`, admin. Remove `penName` | No public query can select `email`; schema diff confirms |
| H3 | P0 | — | **S12:** ownership check in `generatePostSummary` (and any AI path that writes). Per-user hourly quota on AI mutations | Non-owner call → 403; quota → 429 |
| H4 | P1 | — | **S13:** `removeGalleryImage` and download must verify `publicId` belongs to *this* post's gallery before deleting or redirecting | Foreign `publicId` → 404; Cloudinary asset untouched |
| H5 | P0 | — | **S8:** `CustomThrottlerGuard` must override `getRequestResponse` for `graphql` context; `app.set('trust proxy', 1)`; skip throttling when `x-internal-key` matches `INTERNAL_API_KEY`; Redis storage if >1 instance | GraphQL requests don't 500; 6th login in a minute → 429; SSR traffic not throttled |
| H6 | P1 | ✔ | **S6:** replace access-token-in-URL with one-time code exchange | See section 9.1 |
| H7 | P1 | ✔ | Remove `userId` from `reactions`, `currentUserId` from `followStats`, `viewerId` from `recordPostView` (derive from token) | Args absent in schema |
| H8 | P1 | ✔ | `space` **required** on `topPosts`, `trendingTags`; add `space` to `SearchInput` | No cross-space results |
| H9 | P1 | ✔ | List queries `.select('-body')`, return `excerpt`; `body` nullable on `PostModel` | `posts` payload has no body |
| H10 | P1 | ✔ | `PostModel` additions: `bodyFormat` (new enum + schema field, default by space), `excerpt`, `featured` (add to schema, B20), `scheduledAt`, `series{_id,title,slug}`, `seriesOrder`, map `coverImagePublicId` so `coverImageVariants` works (B3) | Fields present and non-null where expected |
| H11 | P1 | — | Slug fixes B1, B2 | Title edit never changes slug; Bangla title → non-empty slug |
| H12 | P1 | — | Integrity B7: comments, reactions, bookmarks, views require an existing, **published** target; validate before writing | Comment on draft/missing post → 404, no orphan row |
| H13 | P1 | ✔ | Gallery B4 + new mutations: `setPostCover(postId, publicId)`, `reorderGallery(postId, publicIds[])`, `updateGalleryImageAlt(postId, publicId, alt)`. Upload without destructive crop | Portrait stays portrait; alt editable |
| H14 | P1 | ✔ | Password reset: add `space` to `forgotPassword`; email brand and link per site (B18) | Misk user gets Misk-branded link |
| H15 | P1 | — | Newsletter back to direct send (or finish the processor and run a worker) | Subscriber receives mail on publish |
| H16 | P1 | — | Security round 2: introspection off in production, `depthLimit(7)`, `escapeRegex` in admin search, global HTTP exception filter, `timingSafeEqual` for cron secret, **Swagger disabled/protected in production** | Introspection query rejected in prod |
| H17 | P1 | — | Fix B5 (series count) and B6 (`recordView`) | See 9.2 |
| H18 | P1 | — | CORS dev ports and env-driven origins; remove `localhost:3000` default from OAuth redirect | Frontend dev origins pass |
| H19 | P1 | — | Joi env validation in `ConfigModule` | Missing secret → boot failure with clear message |
| H20 | P2 | — | Email verification on register | |
| H21 | P2 | — | B9 cascade cleanup and count drift | |
| H22 | P2 | — | B10 text-index language | |
| H23 | P2 | — | `totalCount` opt-in; `Cache-Control` on public REST; cache trending | |
| H24 | P2 | — | Magic-byte sniffing on uploads | |
| H25 | P2 | — | Wire reaction notifications; reply notification titles (B8) | |

**Frontend may start integration after H1–H14 and H16–H18.** Until then it can build against mocks of contract v2.

---

## 9. Known issues and fix sketches

### 9.1 Security

| ID | Issue | Fix |
|---|---|---|
| S1 | Draft/scheduled posts publicly readable (`status: DRAFT` filter unguarded) | H1 |
| S2 | `email` and `role` exposed through `user(id)` and every `author` (earlier guidance saying otherwise was wrong) | H2 |
| S3 | Pen name is not a real disguise: same `_id` on both sites, `user(id)` is public, both names were queryable. **Two separate accounts is the only sound fix** | Drop `penName`; separate accounts |
| S4 | Client-supplied IDs let callers probe others' reactions and follows | H7 |
| S5 | `topPosts`/`trendingTags` leak across spaces | H8 |
| S6 | **Google login cannot hold a session.** The backend callback sets the refresh cookie on the *backend's* domain, then redirects the browser to the frontend. The frontend origin never receives it, so sessions die after 15 minutes. The token in the URL is also poor practice | Callback creates a one-time code and redirects to `${SITE}/auth/callback?code=…`. Frontend POSTs it through the same-origin proxy and the response sets the cookie on the right domain |
| S7 | GraphQL introspection and depth unbounded; admin regex unescaped (ReDoS); REST errors unaudited; cron secret compared with `!==` | H16 |
| S8 | **Throttler is likely broken for GraphQL.** Stock `ThrottlerGuard` reads `switchToHttp()`, which is wrong in GraphQL context. Behind a proxy all users share one IP bucket. In-memory counters are useless across serverless instances | H5 |
| S9 | No email verification on registration | H20 |
| S10 | Uploads trust client MIME type only | H24 |
| S11 | `trackImageDownload` is public and inflatable | Throttle or fold into the download endpoint |
| S12 | **IDOR:** `generatePostSummary(postId)` only checks "logged in", so any user can overwrite any post's summary. AI endpoints also let any account burn the Gemini quota | H3 |
| S13 | **Arbitrary asset deletion:** `removeGalleryImage` calls Cloudinary `destroy(publicId)` without confirming the id belongs to the post. Download endpoint redirects for any `publicId` | H4 |
| S14 | Throttling is per IP only. No per-account lockout for credential stuffing | Roadmap |
| S15 | `npm audit` shows transitive `ws` and dev-only issues; do not run `--force` | Track upstream; run audit in CI |

**S6 fix sketch**
```ts
// auth.controller.ts
@Get('google/callback') @UseGuards(GoogleAuthGuard)
async googleCallback(@Req() req: TypedRequest & { user: GoogleProfile }, @Res() res: Response, @Query('state') state?: string) {
  const user = await this.usersService.findOrCreateFromGoogle(req.user);
  const code = await this.authService.createOAuthCode(user._id.toString()); // 32B random, store sha256, TTL 60s, single use
  res.redirect(`${this.siteUrl(state)}/auth/callback?code=${code}`);        // state allowlisted: 'devscript' | 'personal'
}

@Post('google/exchange') @HttpCode(200)
async exchange(@Body() { code }: ExchangeCodeInput, @Req() req: TypedRequest, @Res({ passthrough: true }) res: Response) {
  const result = await this.authService.consumeOAuthCode(code, this.extractUserAgent(req)); // deletes doc, issues tokens
  this.setRefreshCookie(res, result.refreshToken ?? '');
  return { accessToken: result.accessToken, user: result.user };
}
```

**S8 fix sketch**
```ts
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const { req, res } = GqlExecutionContext.create(context).getContext<{ req: Record<string, any>; res: Record<string, any> }>();
      return { req, res };
    }
    return super.getRequestResponse(context);
  }
  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Too many requests — please slow down.');
  }
}
// main.ts: const app = await NestFactory.create<NestExpressApplication>(AppModule); app.set('trust proxy', 1);
```

### 9.2 Correctness bugs

| ID | Where | Bug | Fix |
|---|---|---|---|
| B1 | `PostsService.update` | Title edit regenerates the slug. This breaks shared links and Pinterest pins, and RSS `guid` = URL so readers see duplicates | Slug immutable after create |
| B2 | `generateUniqueSlug` | `slugify(..., {strict:true})` strips Bengali. A Bangla title yields an empty base and a slug like `-1748…` | Fallback below |
| B3 | `PostCoverImageResolver` | Reads `post.coverImagePublicId`, but `toModel()` never maps it, so `coverImageVariants` is always `null` | Map it (internal, not `@Field`) |
| B4 | `uploadPostCover` used for gallery | Every gallery image is permanently cropped to 1200×630. Portrait Pinterest images are destroyed, and stored width/height are of the crop | Upload with `c_limit`, no crop; crop only at delivery |
| B5 | `SeriesService.addPost` | After assigning `post.series`, the "was it already counted" check is always false, so `postCount` never increments | Compute before assignment |
| B6 | `PostsService.recordView` | `updateOne(..., { $slice: ... })` is not a valid update operator | `$push` with `$each` and `$slice` |
| B7 | `CommentsService.create` | Comment is written *before* the post lookup, so a missing post leaves an orphan comment. Reactions and bookmarks never validate targets | Validate first (H12) |
| B8 | Notifications | `notifyPostReaction` never invoked; reply notifications pass `postTitle: ''` | Wire and fill |
| B9 | Deletes | Deleting a post leaves comments, reactions, bookmarks, notifications, Cloudinary assets, and category/series counts behind | Domain event + cleanup handler |
| B10 | Search | `$text` defaults to English. Poor Bangla matching | `default_language: 'none'` (drop and recreate index); long-term Atlas Search |
| B11 | Lists | `countDocuments` runs on every page | Make opt-in |
| B12 | `uniqueViewers[]` | Unbounded-ish array on a hot document | Separate `post_views` collection (unique on post and viewer hash, TTL) or Redis counters |
| B13 | JWT strategy | DB read on every authenticated request | Short-TTL cache if it becomes hot |
| B14 | AI SDK | `@google/generative-ai` is legacy. TTS request shape and model names change often | Migrate to the current `@google/genai`; verify model ids against Google docs |
| B15 | Narration | Synchronous generation can exceed serverless timeouts | Persistent host or queue + worker |
| B16 | OAuth redirect | Falls back to `localhost:3000` (the API's own port) | Env only, fail if unset |
| B17 | CORS | Dev allowlist has no frontend ports | H18 |
| B18 | Password reset | Link and brand hardcoded to DevScript; Misk users get the wrong site | Pass `space` |
| B19 | `PostModel` | No `series`/`seriesOrder`, so a post page cannot show "Part 2 of 5" | H10 |
| B20 | `featurePost` | Sets `featured`, which is not in the Post schema. Strict mode drops it silently | Add field and index |
| B21 | `PostModel` | `scheduledAt` not exposed; Studio cannot show it | H10 |
| B22 | Gallery | `alt` always `''`; no way to set cover, reorder, or edit alt | H13 |

**B2 fallback**
```ts
import { slugify as transliterate } from 'transliteration'; // verify with real Bangla titles
let base = slugify(title, { lower: true, strict: true });
if (!base) base = transliterate(title) || (space === PostSpace.PERSONAL ? 'poem' : 'post');
return `${base}-${crypto.randomBytes(3).toString('hex')}`; // not Date.now(): avoids same-ms collisions
```

**B5 fix**
```ts
const wasInThisSeries = post.series?.toString() === input.seriesId;
const previous = post.series && !wasInThisSeries ? post.series : null;
post.series = series._id; post.seriesOrder = order; await post.save();
if (previous) await this.seriesModel.updateOne({ _id: previous }, { $inc: { postCount: -1 } });
if (!wasInThisSeries) await this.seriesModel.updateOne({ _id: series._id }, { $inc: { postCount: 1 } });
```

**B6 fix**
```ts
await this.postModel.updateOne(
  { _id: postId, uniqueViewers: { $ne: viewerKey } },
  { $inc: { viewCount: 1 }, $push: { uniqueViewers: { $each: [viewerKey], $slice: -1000 } } },
);
// anonymous viewerKey = sha256(ip + userAgent + yyyy-mm-dd). Hashed and rotating, no raw IP stored.
```

---

## 10. Backend roadmap — what else can be built

### 10.1 Reliability and operations (do first)
| Item | Why | Learns |
|---|---|---|
| Structured logging (pino) with request IDs | You cannot debug production from `console.log` | Observability |
| Sentry (or similar) error tracking | Catch failures users never report | Ops |
| GitHub Actions: lint, typecheck, unit, e2e, build, `npm audit`, schema-diff gate | Regression safety | CI/CD |
| Dockerfile + docker-compose (api, mongo, redis) | Reproducible local and prod | Containers |
| Graceful shutdown, health and readiness split | Zero-downtime deploys | Reliability |
| Backups and restore drill for Atlas | Untested backups are not backups | Data durability |

### 10.2 System design growth (high learning value)
| Item | Why |
|---|---|
| **Domain events** (`@nestjs/event-emitter`): `post.published`, `post.deleted`, `user.deleted` | `PostsModule` currently imports Follows, Notifications, Newsletter, Categories. Events invert that dependency and fix B9 cleanly |
| **Outbox pattern** for newsletter and notification fan-out | Today a crash between "publish" and "send" silently drops mail |
| Idempotency keys on mutating endpoints | Safe client retries |
| Redis cache layer (trending, public lists) with stampede protection | Real read-path scaling |
| Redis-backed rate-limit storage | Correct limits across instances |
| View counters in Redis, flushed in batches | Takes write load off Post documents |
| Revalidation webhook to the Next.js apps on publish | Instant freshness with ISR |
| OpenTelemetry tracing | Find the slow resolver |
| Atlas Search or Meilisearch | Typo tolerance, Bangla analyzers |
| Feature flags | Ship dark, test in prod |

### 10.3 AI engineering (high learning value)
| Item | Notes |
|---|---|
| **Embeddings + vector search** ("poems that feel like this") | Gemini embeddings + Atlas Vector Search. Replaces tag-overlap in related posts |
| **Gentle safety layer** | Classifier flags self-harm language in posts and comments for *human review* and optional supportive-resources banner. Never auto-delete. Measure precision and recall; curate region-appropriate resources yourself |
| **Translation drafts** (Bangla ↔ English) | Gemini drafts, author approves, stored as linked post |
| **Prompt registry + eval harness** | Versioned prompts, golden test set, regression runs when models change |
| AI cost and usage ledger, output caching | Know what each feature costs |
| Guardrails and structured output (JSON schema mode) | Replace regex-stripping of code fences |
| Author-recorded audio as alternative to AI voice (`narrationSource: AI \| AUTHOR`) | For devotional or poetic content a human voice often matters more |
| Multiple TTS voices, Bangla voice validation | Verify Bangla quality before promising it |

### 10.4 Product features
| Item | Notes |
|---|---|
| Quiet "Felt this" reaction (text label, no emoji) | Solidarity without writing a comment. Add enum value |
| Content warnings field | Author-set, shown before body |
| Draft preview links (signed, expiring) | Share an unpublished poem for feedback |
| Revision history and autosave versions | Writers lose work |
| Series → printable PDF/ebook export | Your poems as a book |
| Poem image cards (Next `ImageResponse`) for Instagram/Pinterest | Fits your current workflow; frontend task using existing variant sizes |
| Weekly digest email (cron, direct send) | Retention |
| Reader collections / public reading lists | Community |
| Email verification, 2FA (TOTP), session list ("where am I logged in") | Account security |
| Per-account login throttling and lockout | S14 |
| Stripe tips (one-time) → later subscriptions | Only after an audience exists; reading stays free |

### 10.5 Do not build yet
Microservices, Kubernetes, GraphQL federation, ads, any third-party tracker.

---

## 11. Deployment recommendation

The original plan was "NestJS on Vercel". That works for the read and write API, but several shipped features assume a **long-running process**:

| Feature | Serverless (Vercel) | Persistent host |
|---|---|---|
| `@Cron` post scheduling | ✗ needs external cron; Hobby plan limits frequency | ✓ |
| BullMQ workers | ✗ | ✓ |
| WebSocket notifications | ✗ | ✓ |
| In-memory rate limiting | ✗ per-instance, nearly useless | ✓ (or Redis) |
| Long TTS calls | ✗ timeouts | ✓ |
| Mongoose connection reuse | needs care | ✓ |

**Recommended topology**
- Frontends (Next.js) → **Vercel**
- Backend → one **persistent Node host** (Railway, Render, Fly.io, or a small VPS) with Redis alongside
- Frontends proxy `/api/*` to the backend (same-origin cookies, S6)

If you stay fully on Vercel: use the external-cron endpoint, direct-send email, synchronous narration with a hard text cap, and Redis rate-limit storage. Expect the WS gateway and BullMQ to stay disabled.

**Pre-launch checklist:** every env var set in the host dashboard · Resend domain verified · Google OAuth redirect URIs registered for each environment · CORS origins match real domains · Atlas IP access and backups configured · `NODE_ENV=production` · `JWT_EXPIRES_IN=15m` · Swagger/introspection off · health endpoint wired to an uptime monitor · seed categories for both spaces · create the admin account and the separate Misk account.

---

## 12. Conventions and gotchas learned in this codebase

1. Any class property initialized by a decorator (`@Prop`, `@Field`, `@WebSocketServer`) → use `declare`.
2. Any `@Prop` typed `X | null`, or typed with an enum → pass `type:` explicitly (`type: String, enum: Foo`).
3. Types used in decorated parameters → `import type`.
4. `select: false` on password. Add `.select('+password')` only in login and delete-account.
5. Never `as any`. Map `Document` → model explicitly. `as unknown as T` only after `.populate()`.
6. `.lean()` returns plain objects: no `.populated()`, no `.save()`.
7. Mutating counters → `$inc` / `$addToSet` / `$push+$slice`, never read-modify-write.
8. DB-level unique indexes beat check-then-insert (race-safe). Handle error code `11000`.
9. GraphQL enum *keys* are uppercase in queries (`PUBLISHED`); REST query params use the stored lowercase values.
10. Guards in GraphQL need `getRequest()` through `GqlExecutionContext`. Same for the throttler.
11. `tsconfig` `"types": [...]` is an allowlist: include `node`, `multer`, `jest`.
12. Fire-and-forget (`void promise`) only for work whose failure is acceptable.
13. `npm audit fix --force` is almost never right here; read what it would downgrade.

---

## 13. Folder structure

```
src/
  main.ts · app.module.ts · schema.gql (generated, commit it)
  config/        app · database · jwt · cloudinary · seo · email · redis
  common/        decorators/ filters/ guards/ interfaces/ providers/ scalars/ services/ types/ utils/ common.module.ts
  auth/          dto/ guards/ schemas/ strategies/
  users/         dto/ models/ schemas/
  posts/         constants/ dto/ models/ resolvers/ schemas/ validators/ posts.cron.ts
  comments/  reactions/  follows/  notifications/  search/  bookmarks/
  categories/  series/  admin/  ai/  seo/  newsletter/  email/  account/  health/  queue/
test/            auth.e2e-spec.ts · posts.e2e-spec.ts · jest-e2e.json
```

---

## 14. Learning map

| Skill | Where it lives in this repo | Next step |
|---|---|---|
| SWE fundamentals | DI, modules, DTO validation, error handling, TypeScript strictness | Add the missing tests from section 7 |
| Security | JWT rotation, hashed tokens, IDOR fixes, throttling, enumeration defence | Re-audit after Phase H; threat-model the OAuth flow |
| System design | Cursor pagination, TTL indexes, cached counters, space-scoped multi-tenancy, queue-vs-serverless trade-off | Domain events, outbox, Redis caching |
| Data modeling | Polymorphic reactions, soft delete, anonymize-over-delete | Revisions, post_views collection |
| AI engineering | Prompted summaries, defensive JSON parsing, graceful degradation, TTS | Embeddings, evals, safety classifier |

---

*End of document. Work top-down through Section 8, update the status marks, and keep `devscript-journal.md` as the narrative log.*
