# Decisions and contract differences

Where the live schema (`src/schema.gql`) differs from `FRONTEND_SPEC.md` Appendix A, **the schema wins**. This file records why.

| Topic | Decision | Why |
|---|---|---|
| Hosting | API on Vercel (zero-config NestJS) + cron-job.org | Free without a card; Render may require card verification |
| `posts` visibility | No status filter → PUBLISHED only, unless `authorId` is the caller (then all of the caller's posts). `status: DRAFT/SCHEDULED` is always scoped to the caller | A logged-in feed mixing drafts in is surprising; the Studio asks for its own list |
| Post limits | Title ≥ 1, body 10–100,000 chars | Short poems are welcome; the cap stops huge request bodies |
| Category pages | `PostsFilterInput.categoryId` added | Sitemaps link `/category/[slug]`; there was no way to list a category |
| Notifications | `postSlug`, `postSpace` added | The frontend can link to the post and show only its own site's notifications |
| Public user data | Users populated with public fields only (`users/public-user-fields.ts`) | GraphQL types hid emails, but REST serialized whole documents |
| AI provider | `@google/genai`, models from env (`gemini-3.5-flash-lite`, `gemini-embedding-001`, `gemini-3.8-flash-lite-tts`) | Legacy SDK replaced; model swaps are config, not code |
| AI limits | Per-user daily quota by plan (atomic pipeline update in MongoDB) + per-IP burst throttle + per-instance daily budget | Works across serverless instances; plans are the hook for a paid tier |
| AI output | `STYLE_RULES` in every prompt + `humanize()` on every result | No em dashes, filler or emoji in AI text; code enforces what prompts only request |
| Related posts | Embeddings + brute-force top-k (min-heap) over the latest 500 posts; tag/category scoring as fallback | Simple and fast at blog scale; switch to Atlas Vector Search past ~5k posts |
| Ask this article | Public, 6/hour per IP, answers cached per post version (LRU) | Useful to anonymous readers without burning the free quota |
| Side effects on publish | Awaited with `Promise.allSettled` | Serverless can freeze work that runs after the response |
| Email | Brevo HTTP API (no SDK); no key = log the email | Free sending without owning a domain; local dev needs no email account |
| Search | Text index with `default_language: 'none'`, title weighted 5× | English stemming broke Bangla matching |
| Search pagination | `_id` cursor with relevance sort can skip/repeat on page 2+ | Marked `shortcut:` in `search.service.ts` |
| Vercel cron | `GET /posts/cron/publish-scheduled` daily; cron-job.org every 10 min for precision | Hobby cron is daily only |
| Queue | `QueueModule` not imported | No worker on serverless; `@nestjs/bullmq` 12 is ESM-only and broke Jest |
| Uploads | ≤ 4 MB, type from magic bytes | Vercel's 4.5 MB request limit; the browser shrinks images first |

## Security audit (2026-10-23)

Each finding was reproduced in an offline sandbox (no network, dummy secrets, in-memory MongoDB), fixed, and pinned by `test/security.e2e-spec.ts`.

| Severity | Finding | Fix |
|---|---|---|
| High | **Pre-account takeover.** Signup doesn't verify email; Google sign-in linked to an existing account by email and kept its password, so someone who registered your address first kept a back door | New accounts confirm their email (24 h link). Linking Google to an **unconfirmed** email/password account clears the password and revokes every session; a confirmed account keeps its password |
| High | Google profiles with an **unverified email** could create or link accounts | `email_verified` required for any email-based match |
| Medium | **Login CSRF.** A Google login code worked in any browser, so a link could log a victim into the attacker's account | Code bound to an HttpOnly nonce cookie set when login starts (`auth/oauth-state.ts`) |
| Medium | **HTML injection in emails.** Post titles and messages went into email HTML unescaped | Every template value escaped |
| Medium | GraphQL `subscribeToNewsletter` and `createComment` had **no throttle** (REST twins did): email flooding via our sender | Same `@Throttle` limits as REST |
| Low | `myBookmarks` returned the body of posts unpublished after their author deleted their account | Populate matches PUBLISHED only |
| Low | Deactivated accounts could still **refresh** tokens | `isActive` checked on refresh |
| Low | Uploads were **fully buffered** before the size check | Multer `limits` (413 before buffering) |
| Low | **Narration** bypassed the AI quota | Counts against the per-user quota |
| Low | Proxy sent no client IP when forwarding headers were missing, which **skipped rate limits** | Always sends one (`unknown` bucket) |
| Low | Password-reset links printed to **production logs** when email is unconfigured | Email bodies logged only outside production |

**Accepted / needs validation**
- Registration says "Email already registered", which reveals that an account exists. Standard trade-off; it's rate-limited (3/min).
- Unconfirmed accounts can log in and read but not publish, comment, upload or use the AI writer (`EmailVerifiedGuard`), so a squatted address can't be used to post as someone.
- Per-reader rate limits trust `x-forwarded-for` as set by the hosting platform. Vercel sets it; on another host, confirm the proxy overwrites it before trusting it.
- The sites send a static CSP (no other origins for scripts, connections, frames or forms). It allows inline scripts, so sanitized Markdown is still the main XSS defence; a nonce CSP would close that but turn off page caching.
