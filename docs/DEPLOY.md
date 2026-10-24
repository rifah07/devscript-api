# Deploy DevScript and The Misk Journal for free (no credit card)

Everything below runs on free plans that do **not** ask for a card. You end up with three Vercel projects (one API, two sites) on free `*.vercel.app` addresses.

| Piece | Service | Free plan | Card? |
|---|---|---|---|
| API (`devscript-api`) | Vercel Hobby | Serverless functions | No |
| DevScript site (`devscript-web`) | Vercel Hobby | | No |
| Misk site (same `devscript-web` repo) | Vercel Hobby | | No |
| Database | MongoDB Atlas M0 | 512 MB | No |
| Images and audio | Cloudinary Free | ~25 credits/month | No |
| AI | Google AI Studio (Gemini API) | Free tier, Flash/Flash-Lite models | No |
| Email | Resend Free | Sends to your own address until you verify a domain | No |
| Scheduled posts | cron-job.org | Unlimited jobs | No |

> **Why not Render?** Render may ask for a card to verify free accounts. Everything here works without one.

Time needed: about an hour the first time. Do the steps in order; each one gives you a value the next one needs.

---

## Step 0: Generate your secrets (2 min)

Run this four times and keep the outputs in a private note (never in git):

```bash
openssl rand -hex 32
```

Name them: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `INTERNAL_API_KEY`, `CRON_SECRET`.

## Step 1: MongoDB Atlas (10 min)

1. Sign up at mongodb.com/atlas → **Create** → choose **M0 Free**, a region near Bangladesh (e.g. Mumbai or Singapore).
2. **Database Access** → add a user with a long random password.
3. **Network Access** → **Add IP address** → `0.0.0.0/0`. (Vercel's servers change IPs, so this is needed. The password still protects the database.)
4. **Connect** → **Drivers** → copy the URI. Put your password in it. That's `MONGODB_URI`.
5. On your computer, once, so the search index supports Bangla:
   ```bash
   cd devscript-api
   MONGODB_URI="<your atlas uri>" npm run db:sync-indexes
   ```

## Step 2: Cloudinary (5 min)

Sign up at cloudinary.com → Dashboard → copy **Cloud name**, **API key**, **API secret**.

## Step 3: Gemini API key (2 min)

aistudio.google.com/apikey → **Create API key**. That's `GEMINI_API_KEY`. The free tier is enough for this project; the API also limits itself (25 AI calls per user per day on the free plan, plus a site-wide daily budget).

## Step 4: Resend for email (5 min)

1. Sign up at resend.com (free, no card).
2. **API Keys → Create API key**. That's `RESEND_API_KEY`. Leave `EMAIL_FROM` empty (it uses `onboarding@resend.dev`).

**The limit to know:** until you verify a domain you own in Resend (**Domains → Add domain** and its DNS records), Resend delivers only to your own account address. Readers won't get newsletter confirmations or reset emails yet. A `*.vercel.app` address can't be verified (you don't control its DNS); a cheap domain later fixes it: verify it, set `EMAIL_FROM=no-reply@yourdomain`, redeploy.

## Step 5: Deploy the API on Vercel (10 min)

1. Push `devscript-api` to GitHub.
2. vercel.com → sign up with GitHub (Hobby, free) → **Add New → Project** → import `devscript-api`. Vercel detects NestJS on its own.
3. **Environment Variables**: add everything from `.env.example`:
   - `NODE_ENV=production`, `JWT_EXPIRES_IN=15m`
   - the four secrets from Step 0
   - `MONGODB_URI`, the three Cloudinary values, `GEMINI_API_KEY`, `RESEND_API_KEY`
   - `DEVSCRIPT_URL` and `MISK_JOURNAL_URL`: put placeholders for now (e.g. `https://example.com`) and fix them in Step 7
4. **Deploy**. Open `https://<your-api>.vercel.app/health`; it should say the database is up.

## Step 6: Deploy the two sites (10 min)

Both come from the **same** `devscript-web` repo: two Vercel projects with different settings.

1. Push `devscript-web` to GitHub.
2. **Add New → Project** → import `devscript-web`, name it `devscript`. Environment variables:
   - `NEXT_PUBLIC_SPACE=DEVSCRIPT`
   - `BACKEND_URL=https://<your-api>.vercel.app`
   - `INTERNAL_API_KEY=` (same value as the API's)
   - `NEXT_PUBLIC_SITE_URL=https://devscript.vercel.app` (whatever URL Vercel gives this project; update and redeploy once you see it)
3. **Add New → Project** → import `devscript-web` **again**, name it `misk-journal`. Same variables, except:
   - `NEXT_PUBLIC_SPACE=PERSONAL`
   - `NEXT_PUBLIC_SITE_URL=https://misk-journal.vercel.app`

## Step 7: Connect the pieces (5 min)

1. Back in the API project → Settings → Environment Variables: set `DEVSCRIPT_URL` and `MISK_JOURNAL_URL` to the two real site URLs → **Redeploy**. (These are used for email links, CORS and the Google login redirect.)
2. Optional, Google login: in Google Cloud Console → Credentials → OAuth client → add `https://<your-api>.vercel.app/auth/google/callback` as an authorised redirect URI, and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` on the API.

## Step 8: Scheduled posts with cron-job.org (5 min)

Vercel's free cron runs only once a day (already set in `vercel.json`). For "publish at 9:30", add a free external cron:

1. cron-job.org → sign up → **Create cronjob**.
2. URL: `https://<your-api>.vercel.app/posts/cron/publish-scheduled`, every 10 minutes.
3. **Advanced → Headers**: `Authorization` = `Bearer <your CRON_SECRET>`.

It also keeps the API warm, so the first visitor after a quiet hour doesn't wait for a cold start.

## Step 9: Make yourself admin (2 min)

Register on the DevScript site, then in Atlas → **Browse Collections → users** → your document → set `role` to `admin`. Log out and in again; **Studio → Admin** appears. Add a few categories for each site there.

For Misk, register a **separate account** with your pen name (and a different photo, or none). Separate accounts are what keep the pen name private.

## Checklist

[ ] `/health` on the API is OK
[ ] Register, log in, reload the page: still logged in (refresh cookie works)
[ ] Write a draft in the Studio; open its URL in a private window: 404
[ ] Publish it; it appears on the home page within a few minutes
[ ] Upload an image; add alt text
[ ] Subscribe to the newsletter with another email; the confirmation email arrives
[ ] "Forgot password" email arrives and the link opens the right site
[ ] Ask a question on an article (DevScript) and get an answer

## When something goes wrong

| Symptom | Likely cause |
|---|---|
| API deploy fails at boot with "Invalid environment variables" | A required variable is missing or too short; the message names it |
| Site shows "Something went wrong" everywhere | `BACKEND_URL` wrong, or `INTERNAL_API_KEY` differs between site and API |
| Logged out after every reload | Using the API URL directly instead of the site's `/api` proxy |
| Emails never arrive | Without a verified domain Resend only delivers to your own account address |
| AI buttons say "nothing to suggest" | `GEMINI_API_KEY` missing, or today's free quota is used up |
| Image upload fails for big photos | Shouldn't happen (the browser shrinks them first); check the file is JPEG/PNG/WebP |
