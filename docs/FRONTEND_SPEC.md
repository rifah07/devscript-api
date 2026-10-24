# Frontend Build Spec — DevScript & The Misk Journal

> Audience: Claude Code (Opus) building the frontend from scratch.
> Read this whole file before writing code. Companion: `PROJECT_OVERVIEW.md` (backend state, known issues, Phase H checklist).
> Appendix A is the **authoritative API contract (v2)** and supersedes `devscript-api-reference.md`.

---

## 0. Operating instructions

1. **Do not ask questions unless blocked.** Make the best decision within this spec, record it in `docs/DECISIONS.md`, and continue.
2. **Verify the backend before wiring it.** In dev, introspect the schema and diff it against Appendix A. If a field or argument differs, say so in `DECISIONS.md` and use the *real* schema. Never invent fields.
3. Build **milestone by milestone** (section 12). Each milestone ends green: `typecheck`, `lint`, `test`, `build`, and for reader pages a Lighthouse CI run. Commit per milestone.
4. Backend Phase H items (see `PROJECT_OVERVIEW.md` §8) may not be done yet. Until the schema contains `PublicUserModel`, develop against **MSW mocks generated from Appendix A**, behind `NEXT_PUBLIC_USE_MOCKS=1`.
5. Prefer deleting code to adding abstraction. This is a reading product, not a dashboard. Ship little JavaScript.
6. The result must look **designed**, not templated. See sections 7 and 8. If a screen looks like a default component library, redo it.

---

## 1. Product context

One backend, two sites:

| | **The Misk Journal** (`PERSONAL`) | **DevScript** (`DEVSCRIPT`) |
|---|---|---|
| Purpose | Poems, Islamic reflections, short notes. Replaces Blogspot + Pinterest/Instagram posting | Technical articles; the author's portfolio for job applications |
| Feel | A printed chapbook read by lamplight. Quiet, warm, generous negative space | A well-set technical magazine. Precise, confident, dark-first |
| Primary reader device | **Phone, often at night** | Laptop |
| Languages | Bangla and English content; UI in English (Bangla UI optional later) | English |
| Author identity | Pen name "PP", **separate account** | Real name |

**Mission:** free, calm, ad-free, tracker-free. Some Misk readers are writing about grief or doubt. Treat their attention with care: no popups, no dark patterns, no engagement bait, no streaks, no "X people are reading this".

---

## 2. Hard constraints (non-negotiable)

1. **No face emoji or emoji-as-UI anywhere.** Reactions use text labels and simple line icons.
2. **No third-party trackers or ad scripts.** No GA, no pixels, no session replay.
3. **Access token lives in memory only.** Never `localStorage` or `sessionStorage`. (`sessionStorage` is acceptable for non-secret UI flags like "view already recorded".)
4. **Never use `dangerouslySetInnerHTML`** except for JSON-LD, with `<` escaped.
5. **WCAG 2.2 AA** minimum. Real keyboard support, visible focus, `prefers-reduced-motion` honoured.
6. **Bangla is a first-class script.** Correct fonts, line-height, `lang="bn"` markup. Poems must never be reflowed.
7. Each app hard-codes its own `space`. The user never chooses a space.
8. Pages that don't need per-user data must be statically renderable/cacheable. Per-user state loads client-side after hydration.
9. Hidden content returns the backend's 404. The frontend must render `notFound()`, never "this post is private".

---

## 3. Stack (final decisions)

| Concern | Decision | Notes / rejected |
|---|---|---|
| Framework | **Next.js (latest stable), App Router, React Server Components, TypeScript strict** | |
| Monorepo | **pnpm workspaces + Turborepo** | |
| Server data | **`graphql-request`** inside RSC with Next `fetch` caching | Rejected Apollo/urql: normalized client cache isn't needed when pages are server-rendered |
| Client data | **TanStack Query v5** | Optimistic updates for reactions/bookmarks/follows, polling, Studio |
| Types | **GraphQL Code Generator** (`client-preset`) from the backend `schema.gql` | Typed documents, no hand-written response types |
| Styling | **Tailwind CSS** + CSS variables as design tokens | No component library with a recognizable look |
| Primitives | **Radix UI** (Dialog, Popover, Tooltip, DropdownMenu, Toast) for behavior only, restyled fully | Not shadcn defaults |
| Icons | `lucide-react` (no face icons: avoid `Smile`, `Frown`, etc.) | |
| Motion | CSS first; `motion` library only for lightbox/page choreography; View Transitions API where supported | |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize`; **Shiki** for code, server-side | HTML in markdown disabled |
| Forms | `react-hook-form` + `zod` | |
| Studio editors | **CodeMirror 6** for markdown (DevScript); custom autosizing textarea with poetry affordances for Misk | Not Tiptap/ProseMirror: body is markdown/plaintext, never HTML |
| Dates | `date-fns`, format with fixed locale and `Asia/Dhaka` on the server to avoid hydration mismatch | |
| Fonts | `next/font` (self-hosted), subsets `latin` + `bengali` | See section 8 |
| Mocks | MSW | Until Phase H lands |
| Tests | Vitest + Testing Library; Playwright e2e; `axe-core`; Lighthouse CI | |
| Deploy | Vercel (two projects) | Backend is a separate persistent host |

---

## 4. Repository layout

```
/
  apps/
    misk/           # The Misk Journal   (dev port 3002)
    devscript/      # DevScript          (dev port 3001)
  packages/
    tokens/         # CSS variables + tailwind preset per space
    ui/             # shared unstyled-ish primitives + composed components
    api/            # graphql-request client, codegen output, query documents, error mapping
    auth/           # session store, single-flight refresh, hooks
    studio/         # Studio screens shared by both apps (mounted at /studio in each)
    config/         # eslint, tsconfig, prettier
  docs/DECISIONS.md
  turbo.json  pnpm-workspace.yaml
```

**Studio decision:** Studio is **not** a third app. It is a route group `/studio` mounted in *each* site, sharing code from `packages/studio`.
Reason: sessions are per-origin cookies, so the Misk pen-name account and the DevScript real-name account are *naturally* separate logins with no cross-contamination.
Admin screens live under `/studio/admin` and render only when `me.role === ADMIN`.

---

## 5. Environment and backend contact

**Per app**
```
BACKEND_URL=http://localhost:3000         # server-side only
INTERNAL_API_KEY=...                      # server-side only; sent as x-internal-key on RSC fetches. NEVER NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=http://localhost:3002
NEXT_PUBLIC_SPACE=PERSONAL                # or DEVSCRIPT
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
NEXT_PUBLIC_USE_MOCKS=0
```

**Same-origin proxy (required for cookies)**
```js
// next.config.js (both apps)
module.exports = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL}/:path*` }];
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
};
```
- Browser code calls `/api/graphql`, `/api/auth/refresh`, etc. Never the backend host.
- RSC code calls `${BACKEND_URL}/graphql` directly with `x-internal-key`.
- Backend CORS therefore only matters for tools like Postman. The refresh cookie is `SameSite=Strict` and works because everything is same-origin.

---

## 6. Auth and session architecture

**State:** `accessToken` in a module-level variable plus a React context. User object from `me`.

**Bootstrap:** on first client mount call `POST /api/auth/refresh`. Success → set token, fetch `me`. Failure → anonymous.

**Single-flight refresh — critical.** Refresh tokens are *rotating and single-use*. Two concurrent refreshes make the second fail and the backend revoke the session. Therefore:
```ts
let inflight: Promise<string | null> | null = null;
export function refresh() {
  return (inflight ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => d?.accessToken ?? null)
    .finally(() => { inflight = null; }));
}
```
- React StrictMode double-mounts effects in dev. The bootstrap call must go through this single-flight function or dev sessions will log themselves out.
- On any `401` (GraphQL `extensions.code === 401` or HTTP 401): `await refresh()`, retry the request **once**, else treat as logged out.
- Proactively refresh ~60 s before expiry (decode `exp`); never rely only on 401s.

**Login methods**
- Email/password: `login`, `register`. Show server messages as-is. Login errors are intentionally generic.
- **Google:** navigate the browser to `/api/auth/google?state=personal|devscript` (use the site's value). The backend redirects to `${SITE}/auth/callback?code=…`. The callback page POSTs `{code}` to `/api/auth/google/exchange` (same-origin, so the cookie lands on this origin), stores the returned `accessToken`, then `router.replace` to the saved return path. If the backend still returns `?accessToken=` (Phase H6 not done), read it once and `history.replaceState` it away immediately.
- Forgot/reset password: `/forgot-password` (email, **pass `space`**), `/reset-password?token=` (new password ≥ 8). Always show the same confirmation text after the forgot request.

**Logout:** `logout` mutation, clear token and query cache, redirect home.

**Gating:** Studio pages are client-rendered only, redirecting to `/login?next=` when anonymous. Admin additionally checks `role`.

---

## 7. Data fetching rules

**Server (RSC)**
- Public pages fetch anonymously with `next: { revalidate: 60, tags: ['posts'] }`.
- Anonymous fetch means `userReacted`, `isBookmarked`, `isFollowing` are false/absent. **Do not** read cookies in public pages (it makes them dynamic and uncacheable).
- Attach `x-internal-key` to every server-side backend request.

**Client (TanStack Query)**
- Hydrate user-specific state after the session is ready: `reactions`, `isBookmarked`, `followStats`, `unreadNotificationsCount`.
- **Optimistic updates** for `toggleReaction`, `toggleBookmark`, `followUser`/`unfollowUser`: update cache immediately, rollback on error, refetch on settle.
- Notifications: poll `unreadNotificationsCount` every 30 s **only while the tab is visible** (`visibilitychange`); fetch the list on open.
- Studio autosave: debounce 2 s → `updatePost`; show a quiet "Saved" indicator.

**Pagination:** cursor-based everywhere. First page without `cursor`; next uses `nextCursor`; stop at `hasNextPage === false`. Use `useInfiniteQuery` with an IntersectionObserver sentinel *and* a visible "Load more" button for accessibility. Feeds don't need `totalCount`; don't display it.

**List vs detail:** `posts(...)` returns **no `body`**, use `excerpt`. Full `body` only from `post(slug)`.

**Error mapping** (`extensions.code`)

| Code | UX |
|---|---|
| 400 | Inline field errors from `message` |
| 401 | Refresh and retry once, else login prompt |
| 403 | "You can't do that" toast |
| 404 | `notFound()` |
| 409 | Contextual ("already subscribed", "already following") |
| 429 | Calm toast: "Slow down a little" and disable the control briefly |
| 5xx | Retry affordance; never show raw messages |

**Views:** after 3 s of the post being mounted and visible, call `recordPostView(postId)` once per session per post (`sessionStorage` flag). No viewer ID is sent.

---

## 8. Design system

### 8.1 Mechanics
- `<html data-space="misk|devscript" data-theme="light|dark">`. All colors, fonts and radii are CSS variables from `packages/tokens`; Tailwind theme maps to them.
- Theme: respect `prefers-color-scheme`, allow manual toggle, persist the choice in a cookie or `localStorage` (a UI preference, not a secret). Prevent flash with an inline pre-hydration script. Set `<meta name="theme-color">`.
- Language-aware CSS: `:lang(bn)` switches font stack and line-height (see 8.3).
- Spacing scale based on 4 px; type scale fluid via `clamp()`.

### 8.2 The Misk Journal — direction
Warm, hushed, tactile. A chapbook, not a feed.

| Token | Light | Night |
|---|---|---|
| Paper | warm cream `#F7F1E6` | warm near-black `#15110E` (**not** pure black) |
| Ink | deep umber `#2A2420` | soft parchment `#E9DFCF` |
| Muted | `#7A6F63` | `#9A8E7F` |
| Accent | dried-rose / ambergris, one color only, e.g. `#A4574B` | lifted `#C98476` |
| Rule | hairline `#E4DACB` | `#2A231D` |

- Layout: single centered column, measure 52–62ch for poems. Wide margins. No cards with borders and shadows; separate pieces with whitespace and a small ornament.
- Home: quiet masthead (logo, one-line tagline, theme toggle), latest pieces as a **typographic list** (title, one-line excerpt, date, reading time). Featured series as a gentle strip. Subscribe block at the end, never a popup.
- Poem page: title in display serif, author byline (name only), date, then the poem with stanza spacing. Cover image optional above the title. Gallery shown as a quiet **photo essay** below the text.
- Imagery: full-bleed or inset single images with captions; avoid grids that resemble Instagram.
- Motion: slow fades (200–300 ms), no bouncing, no parallax. Page transitions are crossfades.

### 8.3 Typography and Bangla
Load via `next/font` with `subsets: ['bengali','latin']`. Suggested defaults (swap if you find better pairings, record in DECISIONS):
- Misk display + poem: a refined serif for Latin (e.g. Newsreader / EB Garamond / Cormorant Garamond) with **Noto Serif Bengali** or **Tiro Bangla** for Bangla.
- Misk UI: Hind Siliguri (supports both scripts).
- DevScript: Geist/Inter for UI, Geist Mono/JetBrains Mono for code; Hind Siliguri fallback for Bangla.

Rules:
- Detect Bengali runs (`/[\u0980-\u09FF]/`) and set `lang="bn"` on the containing element. CSS `:lang(bn)` → Bangla stack, line-height **1.9–2.1** for poems (Latin 1.6–1.7), no letter-spacing, no `text-align: justify`.
- Use `text-wrap: pretty` for prose and `balance` for titles.
- Numerals: format dates with `bn-BD` only if the UI language is Bangla; otherwise Latin digits.

### 8.4 DevScript — direction
Dark-first, precise, editorial. Tool-grade clarity without dashboard clichés.

| Token | Dark | Light |
|---|---|---|
| Background | `#0B0C0E` | `#FBFBFA` |
| Surface | `#111316` | `#FFFFFF` |
| Text | `#E6E8EB` | `#14161A` |
| Muted | `#8B929C` | `#5C6370` |
| Accent | one confident signal color (e.g. phosphor `#4ADE9A` or amber `#F5B84B`). Avoid purple-to-blue gradients | darker equivalent for contrast |
| Rule | `#1C2026` | `#E6E8EC` |

- Monospace accents for metadata (dates, tags, reading time), a thin grid feel, generous whitespace, 1 px rules instead of shadows.
- Post page: sticky table of contents, thin reading-progress bar, code blocks with filename, copy button and syntax theme matching the tokens, series navigation, related posts.
- Command palette (`⌘K` / `Ctrl+K`) for search and navigation.
- `/about` and `/projects` are **static pages** (no API): the author's story, projects, GitHub link, résumé link. This site is a portfolio; make these pages excellent.
- Motion: crisp, short (120–180 ms).

### 8.5 Shared components (build in `packages/ui`)
`Prose` (markdown), `PoemBody` (plaintext), `PostListItem`, `PostCard`, `Byline`, `TagChip`, `ReactionBar`, `BookmarkButton`, `FollowButton`, `CommentThread`, `CommentComposer`, `Lightbox`, `GalleryStrip`, `AudioNarrationPlayer`, `NotificationBell`, `SubscribeForm`, `SearchPalette`, `ThemeToggle`, `Pagination (LoadMore)`, `Skeleton` variants, `Toast`, `EmptyState`, `ErrorState`.
Every interactive component needs keyboard behavior, ARIA, focus styles, loading and error states.

---

## 9. Routes

### 9.1 URL contract the backend emits (must exist exactly)
The backend writes these into emails, sitemaps and RSS:

| Path | Purpose |
|---|---|
| `/posts/[slug]` | Post page |
| `/category/[slug]` | Category listing |
| `/confirm-subscription?token=` | Newsletter double opt-in; call `confirmSubscription(token)` on load |
| `/unsubscribe?token=` | Call `unsubscribeFromNewsletter(token)`; show a kind confirmation |
| `/reset-password?token=` | Password reset form |
| `/auth/callback?code=` | OAuth completion (see section 6) |

### 9.2 Misk
`/` · `/poems` · `/reflections` · `/notes` (filtered by `postType`) · `/posts/[slug]` · `/category/[slug]` · `/series` · `/series/[slug]` · `/u/[id]` (public profile) · `/search` · `/bookmarks` (auth) · `/subscribe` · `/about` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/auth/callback` · `/confirm-subscription` · `/unsubscribe` · `/studio/**` · `/sitemap.xml` · `/feed.xml` · `/robots.txt` · `not-found` · `error`

### 9.3 DevScript
`/` · `/posts/[slug]` · `/category/[slug]` · `/tags/[tag]` · `/series/[slug]` · `/u/[id]` · `/search` · `/bookmarks` · `/about` · `/projects` · `/subscribe` · auth pages as above · `/studio/**` · feeds · robots

### 9.4 Studio (both sites)
`/studio` dashboard (`myAnalytics`) · `/studio/posts` (own posts, all statuses) · `/studio/posts/new` · `/studio/posts/[slug]/edit` · `/studio/series` · `/studio/settings` (profile, avatar, export data, delete account) · `/studio/admin` (stats), `/studio/admin/users`, `/studio/admin/reports`, `/studio/admin/categories` (admin only)

Feeds and sitemap: Next route handlers fetch the backend's `GET /sitemap.xml?space=` and `GET /rss.xml?space=` server-side and re-serve with `Content-Type` preserved and `Cache-Control: s-maxage=300, stale-while-revalidate=3600`. Add `<link rel="alternate" type="application/rss+xml">`.

---

## 10. Feature specifications

### 10.1 Reading a post
- `post(slug)` via RSC. `bodyFormat === MARKDOWN` → `Prose`. `bodyFormat === PLAINTEXT` → `PoemBody`.
- **`PoemBody` rules:** split on blank lines into stanzas; render each stanza as one block with `white-space: pre-wrap` (preserves line breaks and leading spaces); no markdown parsing, no trimming of internal lines, no justification. This is the easiest way to silently ruin a poetry site; add a snapshot test.
- `Prose`: sanitize, external links `rel="noopener noreferrer"`, heading anchors, Shiki code blocks, responsive tables in scroll containers, images sized from known dimensions.
- Metadata: `generateMetadata` using `ogTitle`/`ogDescription`/`ogImage` (fall back to title/excerpt/`coverImageVariants.landscape`), canonical URL, `twitter:card=summary_large_image`. JSON-LD `BlogPosting` (articles) or `CreativeWork` (poems). Set `lang`.
- Below the body: reactions, bookmark, share, narration (if `narrationUrl`), gallery, series nav, related (`relatedPosts`), comments, subscribe.

### 10.2 Images and gallery
- Cloudinary delivery: write a custom `next/image` **loader** that builds `https://res.cloudinary.com/<cloud>/image/upload/c_limit,w_<w>,q_auto,f_auto/<publicId>`. This avoids double-processing by Vercel's optimizer. Use `variants.*` URLs for fixed-crop needs (share images, Pinterest pin, story).
- Always reserve space with `width`/`height` from the API (no layout shift). LCP image gets `priority`. Tiny blur placeholders via a low-quality Cloudinary transform.
- **Lightbox:** opens from the gallery strip; keyboard `←`/`→`/`Esc`; swipe on touch; focus trap; returns focus on close; preloads neighbors; shows `alt` and position ("3 / 8"); **Download** button uses `downloadUrl`. Respect reduced motion. Data from `postGallery(postId)` (lightweight).
- Gallery on Misk reads as a photo essay (sequential, captioned), not a mosaic.
- Alt text is required content: the Studio must prompt for it.

### 10.3 Narration player
Appears only when `narrationUrl` exists. Native `<audio>` semantics, custom controls: play/pause, scrub, current/total time (use `narrationDuration` until metadata loads), playback speed, keyboard shortcuts when focused, `aria-label`s, remembers position per post in memory. No autoplay. Quiet visual treatment, not a "podcast widget".

### 10.4 Reactions, bookmarks, follows
- Show reactions `LIKE`, `HELPFUL`, `INSPIRING`, `BRILLIANT` as text-labelled toggles with line icons. **Do not render `SAVED`** (use Bookmarks). Counts from `reactions(targetId, targetType)`. Anonymous click → login prompt (keep the pending action and resume after login).
- Misk may show a reduced set (e.g. `LIKE`, `INSPIRING`) via a per-site constant.
- Bookmark: heart-free icon (bookmark glyph), optimistic.
- Follow button on author pages with `followStats` counts.

### 10.5 Comments
`comments(postId)` returns top-level comments with nested `replies` (one level). Composer requires login. Replies only on top-level comments. `isDeleted` renders a muted "[deleted]" placeholder, keeps replies. Author can edit/delete own; admin can delete any. Optimistic add with rollback. Handle 429 gracefully. Plain text only (render with preserved line breaks, no markdown/HTML).

### 10.6 Notifications
Bell with unread badge in the header (logged in). Dropdown/page lists `notifications` with cursor pagination; item click → `markNotificationRead` then navigate (`/posts/…` needs the post slug: if only `postId` is available, add a tiny resolver route `/p/[id]` that redirects, or request the backend to include `postSlug`; record choice in DECISIONS). "Mark all read" action.

### 10.7 Search
`/search` and palette: debounce 250 ms, min 2 chars, cursor pagination, always pass this site's `space`. Empty/no-result states with kindness (suggest trending tags: `trendingTags(space)`).

### 10.8 Newsletter
`SubscribeForm` (email only, `space` fixed) → `subscribeToNewsletter`. After submit: "Check your email to confirm." Handle 409. Confirm and unsubscribe pages per 9.1. Never pre-checked, never modal.

### 10.9 Studio — writing
- **List:** own posts across statuses with status chips, scheduled time (`scheduledAt`), views, bookmarks.
- **Editor (Misk):** large calm writing surface. Title + body. Stanza-aware tools (insert stanza break, show line numbers toggle). Live preview uses `PoemBody` exactly. Fixed `bodyFormat=PLAINTEXT`, `postType` selector (`POEM`/`REFLECTION`/`NOTE`).
- **Editor (DevScript):** CodeMirror markdown with split preview using `Prose`. `postType` (`ARTICLE`/`NOTE`).
- Common: tags (≤10), category (filtered by `categories(space)`), series assignment, cover, gallery manager (multi-upload ≤10, reorder, set cover, **edit alt text**, delete), autosave, publish / schedule (datetime picker, future only, show in local time, send ISO) / unschedule.
- Gallery upload uses `multipart/form-data` to `POST /api/posts/:id/gallery` field `files`. Encode `publicId` with `encodeURIComponent` in DELETE URLs.
- AI helpers, each a quiet inline suggestion, never auto-applied: `suggestTitles(draft)`, `suggestTags(title, body)`, `generatePostSummary(postId)`, `generateNarration(postId)` (Misk only; can take many seconds: show determinate-feeling progress and allow leaving the page). Show failures gracefully (AI returns empty on error).
- Delete post with confirmation.

### 10.10 Studio — account and admin
- Settings: profile (`updateProfile`), avatar upload (`POST /api/users/me/avatar`, field `file`, ≤5 MB jpeg/png/webp), **export data** (download `/api/account/export`), **delete account** (password confirmation; plain-language explanation that posts are unpublished, comments anonymized).
- Misk account guidance: do **not** reuse the DevScript avatar (the Cloudinary id would link the accounts). Note this in the avatar uploader on Misk.
- Admin (role gated): `platformStats`, `adminUsers` (search, filter, activate/deactivate, change role), `adminReports` + `reviewReport`, categories CRUD (space-scoped), `featurePost`. Users here are full `UserModel` (email visible); never reuse admin user components on public pages.

### 10.11 Reporting
Every post and comment has a "Report" action → modal with reason select (`SPAM`, `INAPPROPRIATE`, `MISINFORMATION`, `HARASSMENT`, `COPYRIGHT`, `OTHER`) and optional note ≤500 chars → `reportContent`. Handle 409 ("already reported") kindly.

---

## 11. Non-functional requirements

**Performance (mobile, Slow 4G, mid-tier device)**
- Misk post page: LCP ≤ 2.0 s, CLS ≤ 0.05, INP ≤ 200 ms. Client JS ≤ ~120 KB gzip on reading pages.
- Reading pages are server components with small client islands (reactions, bookmark, narration, lightbox, comments, notifications).
- Fonts: subset, `display: swap`, preload the primary text face only.
- No layout shift from images, fonts, or late-loading UI.
- Lighthouse CI thresholds on post and home pages: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO 100.

**Accessibility**
Landmarks, skip link, logical heading order, focus management in dialogs, labelled forms, error text tied to inputs, `aria-live` for toasts and save status, 4.5:1 contrast (check *both* themes), touch targets ≥ 44 px on Misk, `lang` attributes, captions or transcript affordance for audio when available.

**Security**
CSP with nonces, no inline scripts except the theme bootstrap (hashed), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options`, frame-ancestors none. Sanitize all markdown. Never log tokens. `INTERNAL_API_KEY` must not appear in client bundles (add a CI grep).

**SEO**
Per-page metadata, canonical, OG/Twitter, JSON-LD, sitemap + RSS proxies, `robots`, meaningful 404s, `lang` per page, clean slugs (never change them).

**Privacy**
No analytics beyond `recordPostView`. No cookies except the auth refresh cookie (set by backend) and the theme preference.

---

## 12. Milestones and definition of done

| # | Milestone | Done when |
|---|---|---|
| M0 | Foundation | Monorepo, tokens, fonts (incl. Bangla), CI (typecheck, lint, test, build), Playwright + axe wired, `DECISIONS.md` |
| M1 | Contract and auth | Codegen from schema, API client with error mapping, MSW mocks, session store with single-flight refresh, login/register/Google/forgot/reset pages, `me` hook. Works in both apps |
| M2 | Misk reading | Home, post page (`PoemBody`), poems/reflections/notes lists, category, series, search, subscribe/confirm/unsubscribe, feeds, metadata, 404/error. Lighthouse thresholds met |
| M3 | Studio MVP | Create/edit/autosave, publish/schedule, gallery upload with alt text, tags/category. Author can publish a real poem end-to-end |
| M4 | DevScript reading | Home, article page (`Prose`, TOC, code blocks, progress), tags, series, search palette, `/about`, `/projects` |
| M5 | Interactions | Reactions, bookmarks, follows, comments, notifications, reporting, profiles, all optimistic with rollback |
| M6 | Gallery + narration polish | Lightbox with download, photo-essay layout, narration player, AI helpers in Studio |
| M7 | Studio advanced + admin | Series management, settings (export/delete), admin screens |
| M8 | Hardening | Full a11y pass, perf budgets, CSP, error-state audit, e2e suite green, README |
| M9 | Deploy | Two Vercel projects, env vars, OAuth redirect URIs, domains, monitoring |

---

## 13. Testing

- **Unit:** `PoemBody` (stanza and line-break preservation; Bangla sample), language detection, error mapper, single-flight refresh (assert concurrent calls issue one request), cursor pagination hook, Cloudinary loader.
- **Component:** `ReactionBar` optimistic rollback, `Lightbox` keyboard, `CommentThread` deleted placeholder, `SubscribeForm` states.
- **E2E (Playwright, run against MSW or a seeded backend):** read a poem on a 390 px viewport; subscribe flow; register → login → refresh persists across reload; Google callback exchange (mocked); write → autosave → publish; draft is 404 to anonymous; reaction/bookmark optimistic; lightbox navigation and download; theme toggle without flash.
- **A11y:** axe on every route in both themes.
- **Visual:** Playwright screenshots for key pages in light and night, mobile and desktop.

---

## 14. Pitfalls that silently break things

1. Parallel refresh calls (StrictMode, multiple queries) revoke the session. Use single-flight.
2. Reading cookies in a public page makes it dynamic and uncacheable.
3. GraphQL enum **keys** are uppercase in documents (`PUBLISHED`, `PERSONAL`); REST query params use lowercase values (`published`, `personal`).
4. `body` is `null` in list responses. Don't render it there.
5. Passing `userId`, `viewerId`, or `currentUserId` args: they no longer exist.
6. Markdown rendering collapses single newlines. Never render poems through it.
7. Missing Bengali font subset produces tofu boxes or system-font fallback with broken line-height.
8. Hydration mismatch from locale/timezone date formatting. Format with fixed locale and timezone.
9. Slugs never change after creation. Don't build "edit slug" UI.
10. `SAVED` reaction duplicates Bookmarks. Hide it.
11. Gallery `publicId` contains slashes. URL-encode it in path params.
12. 429 from comments (10/min) and auth endpoints. Surface it calmly; don't retry in a loop.
13. `INTERNAL_API_KEY` leaking via a `NEXT_PUBLIC_` prefix.
14. Trusting the pen name: never display, cache or link anything that associates the Misk account with the DevScript account (shared avatar, shared email in `mailto:` links, cross-site "also by" links).
15. Series navigation needs `PostModel.series` and `seriesOrder` (Phase H10). If absent, derive prev/next from `series(slug).posts` order.

---

## Appendix A — API contract v2 (authoritative)

> Target contract after backend Phase H. Verify against the live schema (section 0.2).
> Auth: `Authorization: Bearer <accessToken>` for GraphQL and REST. "Optional" = works anonymously, personalizes if a token is present.
> GraphQL endpoint (browser): `POST /api/graphql`. Server-side: `POST ${BACKEND_URL}/graphql`.

### A.1 Enums
```
PostSpace:   DEVSCRIPT | PERSONAL
PostType:    ARTICLE | POEM | REFLECTION | NOTE        (DEVSCRIPT: ARTICLE, NOTE · PERSONAL: POEM, REFLECTION, NOTE)
PostStatus:  DRAFT | SCHEDULED | PUBLISHED
BodyFormat:  MARKDOWN | PLAINTEXT
ReactionType: LIKE | HELPFUL | INSPIRING | BRILLIANT | SAVED   (hide SAVED)
ReactionTargetType: POST | COMMENT
NotificationType: NEW_FOLLOWER | POST_COMMENT | COMMENT_REPLY | POST_REACTION | NEW_POST_FROM_FOLLOWING
ReportReason: SPAM | INAPPROPRIATE | MISINFORMATION | HARASSMENT | COPYRIGHT | OTHER
ReportStatus: PENDING | REVIEWED | RESOLVED | DISMISSED
ReportTargetType: POST | COMMENT | USER
UserRole: USER | ADMIN
```

### A.2 Types
```graphql
PublicUserModel { _id name bio avatarUrl website github twitter createdAt }
UserModel       { _id email name role bio avatarUrl website github twitter createdAt }   # me / updateProfile / admin only
CategoryModel   { _id name slug description space postCount createdAt }
ImageVariants   { thumbnail square pinterestPin landscape story original }
GalleryImageModel { url publicId width height alt order downloadCount variants{ImageVariants} downloadUrl }
PostModel {
  _id title slug excerpt body(nullable; detail only) summary tags[] space postType bodyFormat status
  scheduledAt featured coverImageUrl coverImageVariants{ImageVariants}(nullable)
  gallery[GalleryImageModel] author{PublicUserModel} category{CategoryModel}(nullable)
  series{ _id title slug }(nullable) seriesOrder(nullable)
  readTime viewCount bookmarksCount ogTitle ogDescription ogImage
  narrationUrl narrationDuration createdAt updatedAt
}
PaginatedPosts { posts[PostModel] nextCursor hasNextPage totalCount }
PostGalleryModel { postId postTitle images[GalleryImageModel] }
CommentModel { _id body author{PublicUserModel} post parent isDeleted replies[CommentModel] createdAt }
ReactionSummary { type count userReacted }
FollowStats { followersCount followingCount isFollowing }
PaginatedUsers { users[PublicUserModel] nextCursor hasNextPage totalCount }
NotificationModel { _id actor{PublicUserModel} type message postId commentId isRead createdAt }
PaginatedNotifications { notifications[] unreadCount nextCursor hasNextPage totalCount }
SeriesModel { _id title slug description coverImageUrl author{PublicUserModel} space postCount posts[PostModel] createdAt }
SearchResult { posts[PostModel] totalCount nextCursor hasNextPage }
TrendingTag { tag count }
AuthorAnalytics { totalViews totalPosts totalBookmarks topPosts[PostModel] }
AuthResponse { accessToken user{UserModel} }
```

### A.3 Operations

**Auth** (rate-limited; handle 429)
| Operation | Args | Returns | Auth |
|---|---|---|---|
| `register` | `{email,name,password(≥8)}` | AuthResponse (+cookie) | no |
| `login` | `{email,password}` | AuthResponse (+cookie) | no |
| `refreshToken` | — | `{accessToken}` | cookie |
| `logout` | — | Boolean | yes |
| `logoutAllDevices` | — | Boolean | yes |
| `forgotPassword` | `{email, space}` | Boolean (always true) | no |
| `resetPassword` | `{token,newPassword}` | Boolean | no |

REST (browser calls via `/api`): `POST /auth/refresh` (cookie → `{accessToken}`), `GET /auth/google?state=devscript|personal` (navigation), `POST /auth/google/exchange` `{code}` → `{accessToken,user}` + cookie, `POST /auth/forgot-password`, `POST /auth/reset-password`.

**Users**
| Operation | Args | Returns | Auth |
|---|---|---|---|
| `me` | — | UserModel | yes |
| `user` | `id` | PublicUserModel | no |
| `updateProfile` | `{name?,bio?,website?,github?,twitter?}` | UserModel | yes |
REST: `POST /users/me/avatar` (multipart `file`, ≤5 MB jpeg/png/webp) → `{avatarUrl}`.

**Posts**
| Operation | Args | Returns | Auth |
|---|---|---|---|
| `posts` | `filter?{space,postType,status,tag,authorId,cursor}` | PaginatedPosts (no body) | Optional |
| `post` | `slug` | PostModel (with body) | Optional |
| `createPost` | `{title(2–150),body(≥10),tags?(≤10),space,postType?,categoryId?}` | PostModel (DRAFT) | yes |
| `updatePost` | `{id, …optional fields}` | PostModel | author/admin |
| `publishPost` | `id` | PostModel | author/admin |
| `schedulePost` | `postId, scheduledAt(ISO, future)` | PostModel | author/admin |
| `cancelSchedule` | `postId` | PostModel | author/admin |
| `deletePost` | `id` | Boolean | author/admin |
| `relatedPosts` | `postId, limit?` | [PostModel] | Optional |
| `postGallery` | `postId` | PostGalleryModel | Optional |
| `setPostCover` | `postId, publicId` | PostModel | author/admin |
| `reorderGallery` | `postId, publicIds[]` | PostModel | author/admin |
| `updateGalleryImageAlt` | `postId, publicId, alt` | PostModel | author/admin |
| `recordPostView` | `postId` | Boolean | no |
| `myAnalytics` | — | AuthorAnalytics | yes |

Notes: anonymous `posts` returns PUBLISHED only. Authenticated `posts` also includes the caller's own drafts/scheduled. `posts(filter:{authorId:<me>})` lists all of one's own. `status:DRAFT` or `SCHEDULED` is always scoped to the caller's own. Non-visible posts return **404**.

REST: `POST /posts/:id/gallery` (multipart `files`, ≤10), `DELETE /posts/:id/gallery/:publicId` (URL-encode), `GET /posts/:postId/gallery/:publicId/download` (302 to forced download).

**AI** (auth required; per-user quotas → 429)
| Operation | Args | Returns |
|---|---|---|
| `suggestTitles` | `draft` | `{suggestions[]}` |
| `suggestTags` | `title, body` | `{suggestions[]}` |
| `generatePostSummary` | `postId` (owner only) | String |
| `generateNarration` | `postId` (PERSONAL only, owner/admin) | PostModel with `narrationUrl`, `narrationDuration` |

**Comments** (create limited to 10/min)
| Operation | Args | Returns | Auth |
|---|---|---|---|
| `comments` | `postId` | [CommentModel] top-level with `replies` | no |
| `createComment` | `{body(1–1000),postId,parentId?}` | CommentModel | yes |
| `updateComment` | `{id,body}` | CommentModel | author |
| `deleteComment` | `id` | Boolean | author/admin |

**Reactions**
| Operation | Args | Returns | Auth |
|---|---|---|---|
| `toggleReaction` | `{targetId,targetType,type}` | Boolean (true added) | yes |
| `reactions` | `targetId, targetType` | [ReactionSummary] (`userReacted` from token) | Optional |

**Bookmarks:** `toggleBookmark(postId): Boolean` · `myBookmarks(cursor?): PaginatedPosts` · `isBookmarked(postId): Boolean` (all auth).

**Follows:** `followUser(userId)`, `unfollowUser(userId)` (auth) · `followers(userId,cursor?)`, `following(userId,cursor?)`: PaginatedUsers · `followStats(userId): FollowStats` (Optional).

**Notifications** (auth): `notifications(cursor?,unreadOnly?)` · `unreadNotificationsCount: Int` · `markNotificationRead(id)` · `markAllNotificationsRead`.

**Search**
| Operation | Args | Returns |
|---|---|---|
| `search` | `input{query(≥2),space,tag?,authorId?,cursor?,limit?(≤20)}` | SearchResult |
| `topPosts` | `space!, limit?` | [PostModel] |
| `trendingTags` | `space!, limit?` | [TrendingTag] |

**Categories:** `categories(space?)`, `category(slug)` public · `createCategory{name,description?,space}`, `updateCategory`, `deleteCategory` admin.

**Series:** `series(slug)` (posts in order), `authorSeries(authorId)` public · `createSeries{title,description?,space}`, `addPostToSeries{seriesId,postId,order?}`, `removePostFromSeries(postId)`, `deleteSeries(seriesId)` (owner).

**Newsletter (public):** `subscribeToNewsletter{email,space}`, `confirmSubscription(token)`, `unsubscribeFromNewsletter(token)`, `newsletterSubscriberCount(space)`.

**Reports:** `reportContent{targetId,targetType,reason,description?}` (any logged-in user).

**Account:** `exportMyData` (JSON) or REST `GET /account/export` (file download) · `deleteMyAccount{password}` or REST `DELETE /account/delete` `{password}`.

**Admin** (role ADMIN): `platformStats` · `adminUsers(filter{search,role,isActive,cursor})` · `deactivateUser`/`activateUser(userId)` · `changeUserRole(userId,role)` · `adminDeletePost`/`adminDeleteComment` · `featurePost(postId,featured)` · `adminReports(status?,cursor?)` · `reviewReport{reportId,status,adminNote?}`.

**Feeds (REST, raw XML/text):** `GET /sitemap.xml?space=`, `GET /rss.xml?space=`, `GET /robots.txt?space=` where `space` is lowercase `devscript|personal`. **Health:** `GET /health`.

### A.4 Reusable fragments
```graphql
fragment PublicUser on PublicUserModel { _id name bio avatarUrl website github twitter createdAt }

fragment PostCard on PostModel {
  _id title slug excerpt tags space postType bodyFormat readTime createdAt
  coverImageUrl coverImageVariants { square landscape thumbnail }
  category { _id name slug }
  author { ...PublicUser }
}

fragment PostFull on PostModel {
  ...PostCard
  body summary ogTitle ogDescription ogImage updatedAt
  narrationUrl narrationDuration
  series { _id title slug } seriesOrder
  gallery { url publicId width height alt order
            variants { thumbnail square pinterestPin landscape story original } downloadUrl }
}
```

### A.5 Error shape
GraphQL: `{ errors: [{ message, extensions: { code, statusCode } }] }` with HTTP-style codes (400, 401, 403, 404, 409, 429, 500).
REST: `{ statusCode, message, error? }`. In production, unexpected errors are masked as "Internal server error".

---

*End of spec. When this document and the live schema disagree, the schema wins. Record the difference in `docs/DECISIONS.md`.*
