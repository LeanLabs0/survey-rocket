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


### 2. Database

Vercel does not run SQL. In the Supabase SQL editor, apply `drizzle/0000_init.sql` through `drizzle/0007_password_set.sql` in order, then from a laptop:

```
npm install
npm run db:seed
```


### 3. Check

1. `https://surveyrocket.ai` — landing.
2. Try the live demo → `https://beta.surveyrocket.ai/demo`.
3. `https://beta.surveyrocket.ai/login` — sign in.
4. `https://surveyrocket.ai/app` — redirects to beta.



## Pilot (Lean Labs)

1. Super-admin opens `/admin/clients`, confirms `lean-labs`.
2. Invite Kevin / Ralph, then `/app/lean-labs/surveys`.
3. Publish a survey, open `/s/{publicId}` on a phone, complete with name + email.
4. Results table shows the row; HubSpot contact gets `sr_last_survey`, `sr_last_completed_at`, and `sr_completed__<slug>` (custom object only if the portal allows it).
5. Record a Loom of that path for Kevin and Ralph.