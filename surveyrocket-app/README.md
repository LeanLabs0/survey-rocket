# Survey Rocket app

Landing: **https://surveyrocket.ai** · App: **https://beta.surveyrocket.ai**

One Vercel project. Root Directory = `surveyrocket-app`. The HubSpot developer platform project **Survey Rocket** is managed in HubSpot (and locally via HubSpot CLI), not this Vercel deploy.

## Stack

Astro 5 (SSR) + `@astrojs/vercel` + React islands + Drizzle + Supabase (Postgres + Auth). factor8 is only `POST /turn` and `POST /scan`.

## Launch on Vercel

Do this in order. You need GitHub access to `LeanLabs0/survey-rocket`, a Vercel account on the Lean Labs team, and the env values from `.env.example` (copy from a teammate or from local `.env` — never commit `.env`).

### 1. Import the repo

1. [vercel.com/new](https://vercel.com/new) → Import `LeanLabs0/survey-rocket`.
2. **Root Directory:** `surveyrocket-app` (Edit, not the repo root).
3. Framework: Astro. Build: `npm run build`. Node: **22.x**.
4. Do not set an output directory. The `@astrojs/vercel` adapter handles that.

### 2. Env vars (Project → Settings → Environment Variables)

Paste these for Production (and Preview if you test OAuth there):

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DATABASE_URL
PUBLIC_SITE_URL=https://beta.surveyrocket.ai
PUBLIC_APP_URL=https://beta.surveyrocket.ai
FACTOR8_API_URL=https://factor8-agent-sdk.fly.dev/api/v1/public/survey-rocket
FACTOR8_SERVICE_KEY
HUBSPOT_APP_CLIENT_ID
HUBSPOT_APP_CLIENT_SECRET
HUBSPOT_APP_REDIRECT_URI=https://beta.surveyrocket.ai/api/hubspot/oauth/callback
HUBSPOT_TOKEN_ENCRYPTION_KEY
IP_SALT
CRON_SECRET
```

`DATABASE_URL` is the Supabase **Transaction pooler** (port **6543**). Skip `DEV_LOGIN_PASSWORD`. Deploy once so `*.vercel.app` works before you attach custom domains.

### 3. Domains (Project → Settings → Domains)

| Domain | Role |
|---|---|
| `surveyrocket.ai` | Landing (`/`) |
| `www.surveyrocket.ai` | Redirect to `surveyrocket.ai` |
| `beta.surveyrocket.ai` | App (`/login`, `/app`, `/demo`, `/s/…`) |

DNS:

- Apex `surveyrocket.ai` — use the A / ALIAS records Vercel shows (or Vercel nameservers). Turn **off GitHub Pages** for this repo if it is still enabled (Settings → Pages).
- `www` and `beta` → CNAME `cname.vercel-dns.com`.

If `surveyrocket.ai/login` is hit, middleware 308s to `https://beta.surveyrocket.ai/login`. `beta.surveyrocket.ai/` 308s to the marketing site.

### 4. Supabase Auth URLs

Authentication → URL configuration:

- Site URL: `https://beta.surveyrocket.ai`
- Redirect allow list: `https://beta.surveyrocket.ai/auth/callback` and `http://localhost:4321/auth/callback`

### 5. Database

Vercel does not run SQL. In the Supabase SQL editor, apply `drizzle/0000_init.sql` through `drizzle/0006_lists_soft_delete.sql` in order, then from a laptop:

```
npm install
npm run db:seed
```

### 6. HubSpot + factor8

HubSpot app redirect already includes `https://beta.surveyrocket.ai/api/hubspot/oauth/callback`. After a scope change, workspaces must Reconnect HubSpot. Ask factor8 to allow `https://beta.surveyrocket.ai`.

Cron `/api/cron/hubspot-retry` every 15 minutes needs **Vercel Pro**. Hobby only runs daily.

### 7. Check

1. `https://surveyrocket.ai` — landing.
2. Try the live demo → `https://beta.surveyrocket.ai/demo`.
3. `https://beta.surveyrocket.ai/login` — sign in.
4. `https://surveyrocket.ai/app` — redirects to beta.

## One-time setup (Supabase / seed)

1. **Supabase** (Bradley): create a project in the Lean Labs org. Copy `DATABASE_URL` from the green **Connect** button (Transaction pooler, port 6543). `SUPABASE_URL` is `https://<project-ref>.supabase.co`. Use **API Keys → Publishable and secret** (`sb_publishable_…` / `sb_secret_…`), not the legacy JWT tab.
2. Run `drizzle/0000_init.sql` in the SQL editor (tables, RLS, `auth.users` → `profiles` trigger).
3. Copy `.env.example` → `.env` locally. Same names in Vercel Project Settings.

4. Seed Lean Labs and the two sample surveys:

```
npm install
npm run db:seed
```

5. Mark Lean Labs operators as super-admin after they magic-link in once:

```sql
update profiles set is_superadmin = true
where email in ('you@lean-labs.com');
```

**HubSpot** is the developer platform project **Survey Rocket** (portal Auth → Client ID / secret). Copy those into this `.env` and into Vercel. Redirect URLs already on the app: `http://localhost:4321/api/hubspot/oauth/callback` and `https://beta.surveyrocket.ai/api/hubspot/oauth/callback`. After changing scopes, every workspace must **Reconnect HubSpot**.

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