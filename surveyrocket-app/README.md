# Survey Rocket app

The multi-client product at **https://beta.surveyrocket.ai**.

This folder is the Astro app. The parent `survey-rocket` repo remains the GitHub Pages prototype until DNS and Vercel cut over.

## Stack

Astro 5 (SSR) + `@astrojs/vercel` + React islands + Drizzle + Supabase (Postgres + Auth). factor8 is only `POST /turn` and `POST /scan`.

## One-time setup

1. **Supabase** (Bradley): create a project in the Lean Labs org. Copy `DATABASE_URL` from the green **Connect** button (Transaction pooler, port 6543). `SUPABASE_URL` is `https://<project-ref>.supabase.co`. Use **API Keys → Publishable and secret** (`sb_publishable_…` / `sb_secret_…`), not the legacy JWT tab.
2. Run `drizzle/0000_init.sql` in the SQL editor (tables, RLS, `auth.users` → `profiles` trigger).
3. **Vercel**: import this `surveyrocket-app` directory (Root Directory = `surveyrocket-app` if the GitHub repo stays `LeanLabs0/survey-rocket`, or push `LeanLabs0/surveyrocket-app` as its own repo).
4. **DNS**: `beta.surveyrocket.ai` CNAME to `cname.vercel-dns.com`.
5. **factor8** (Ralph): service key for `/turn` and `/scan`, allow the Vercel origin.
6. Copy `.env.example` → `.env` locally. Same names in Vercel Project Settings.

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
DATABASE_URL=
PUBLIC_SITE_URL=https://beta.surveyrocket.ai
FACTOR8_API_URL=https://factor8-agent-sdk.fly.dev/api/v1/public/survey-rocket
FACTOR8_SERVICE_KEY=
HUBSPOT_APP_CLIENT_ID=
HUBSPOT_APP_CLIENT_SECRET=
HUBSPOT_APP_REDIRECT_URI=https://beta.surveyrocket.ai/api/hubspot/oauth/callback
HUBSPOT_TOKEN_ENCRYPTION_KEY=
IP_SALT=
CRON_SECRET=
```

7. Seed Lean Labs and the two sample surveys:

```
npm install
npm run db:seed
```

8. Mark Lean Labs operators as super-admin after they magic-link in once:

```sql
update profiles set is_superadmin = true
where email in ('you@lean-labs.com');
```

HubSpot OAuth redirect must also be listed on the HubSpot app: `https://beta.surveyrocket.ai/api/hubspot/oauth/callback`.

## Local

```
npm install
npm run dev
```

Magic-link redirect: `http://localhost:4321/auth/callback`. Add it in Supabase Auth URL config.

## Pilot (Lean Labs)

1. Super-admin opens `/admin/clients`, confirms `lean-labs`.
2. Invite Kevin / Ralph, then `/app/lean-labs/surveys`.
3. Publish a survey, open `/s/{publicId}` on a phone, complete with name + email.
4. Results table shows the row; HubSpot contact gets `sr_last_survey`, `sr_last_completed_at`, and `sr_completed__<slug>` (custom object only if the portal allows it).
5. Record a Loom of that path for Kevin and Ralph.

## GitHub Pages

The static prototype (`index.html`, `app.html`, `survey.html`) redirects to beta.surveyrocket.ai after cutover.
