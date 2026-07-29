// DEPLOYMENT NOTE for Vercel:
// vercel.json's cron feature calls your endpoint on the schedule above
// (every minute). Vercel automatically adds its own internal auth header,
// but to be safe we ALSO check our own CRON_SECRET.
//
// After deploying, go to Vercel dashboard → Settings → Environment Variables
// → set CRON_SECRET to the same value you have in your local .env
//
// Then update the endpoint to also accept Vercel's built-in cron header,
// OR configure Vercel to pass your custom header via the cron config:
//
// {
//   "crons": [{
//     "path": "/posts/cron/publish-scheduled",
//     "schedule": "* * * * *",
//     "headers": { "x-cron-secret": "@cron_secret" }
//   }]
// }
//
// Note: Vercel Cron Jobs require a Pro plan for schedules more frequent
// than once per day on the Hobby (free) tier. Check current Vercel pricing
// before relying on per-minute scheduling in production.