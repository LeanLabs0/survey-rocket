# Survey Rocket, handoff to Edward

Written 2026-09-02 by Ralph (with Claude). Everything below is live and verified on the deployed product. Read this once, then the two docs it points at, and you have the whole picture.

## What it is, in one breath

Clients run short chat surveys with their own customers. Answers post to a shared store. The app rolls them into numbers the client can publish on the page that makes the claim, with the survey as the proof behind each number.

## Where it lives

| Thing | Where |
|---|---|
| Live app (client side) | https://leanlabs0.github.io/survey-rocket/app.html |
| Landing + demo | https://leanlabs0.github.io/survey-rocket/ |
| Respondent page | https://leanlabs0.github.io/survey-rocket/survey.html?id=<survey-id> |
| Frontend repo | `LeanLabs0/survey-rocket` (static: `index.html`, `app.html`, `survey.html`, `js/`, `assets/`), GitHub Pages from `main` |
| Backend | `LeanLabs0/factor8-agent-sdk`, route file `src/factor8/api/routes/survey_rocket.py`, deployed on Fly as `factor8-agent-sdk` (push to `main` plus the `fly-deploy.yml` workflow) |
| Data | Supabase, the factor8 project. Tables `survey_responses` and `survey_definitions` |
| Agents | `.claude/agents/survey-rocket-interviewer.md` (judges free-text answers per turn) and `survey-rocket-designer.md` (reads a page, drafts surveys for unbacked claims) in the factor8 repo |

No build step anywhere on the frontend. Edit HTML, push, Pages deploys in about a minute.

## The two documents that matter for your work

- `docs/response-contract.md`: the exact shape of a completed response record. This is what lands in `survey_responses.record` (jsonb). Your database work reads this shape; if you change it, change the doc first.
- `docs/question-schema.md`: the survey definition (schema_version 1, settings, provenance, question types). This is what lands in `survey_definitions.definition`.

Older planning docs (`completion-backend-spec.md`, `agents-spec.md`, `v1-build-plan.md`) are history; where they disagree with the two above, the two above win.

## Endpoints (all under `https://factor8-agent-sdk.fly.dev/api/v1/public/survey-rocket/`)

| Method and path | Who calls it | Auth | What it does |
|---|---|---|---|
| `POST /turn` | respondent page, per free-text answer | none, rate limited | the judge: accept / probe / reject, extracts the number |
| `POST /responses` | respondent page on completion | none, rate limited | writes the record; text/plain body (CORS simple request), keepalive, upsert on `(survey_id, client_response_id)` |
| `GET /results/{survey_id}` | app dashboard, respondent ending, survey cards | none, rate limited | aggregates only: counts, averages, choice shares, rating bands, this_week, latest_at, review counts. No names, text or hashes, ever |
| `GET /surveys/{survey_id}` | respondent page on load | none, rate limited | the published definition |
| `PUT /surveys/{survey_id}` | app editor on Save | admin key | publishes the definition (this is what makes one link always serve the newest save) |
| `GET /responses` | app Results | admin key | every record, newest first. Wrong key gets an empty 200, not an error |
| `POST /scan` | app scan screen | admin key | the designer agent, reads one page, drafts surveys |

The admin key is `FACTOR8_SR_ADMIN_KEY` on Fly, its own secret, deliberately not the factor8 master key. `FACTOR8_SR_IP_SALT` salts the IP hash.

## The auth model, so you do not reinvent it

There is no login. The client never sees a key. Lean Labs sends them a private link once: `app.html?key=<admin key>`. The app stores the key in that browser's localStorage, scrubs it from the URL, and never shows or asks for it again. Without the link, the app still works: Dashboard and Results show the public aggregates, and one line says where the names live. Ralph has the current key; ask him for the link, do not put the key in ClickUp or a shared doc.

## What is done and verified

- Chat engine with the live judge, two-probe budget, one hint bubble per question, 44px touch targets, works on phones.
- Editor: questions, five answer types (Multiple choice, Pick several, Rating 0 to 10, Number, Open text), option chips, per-survey toggles (require name and email, show results, ask for a review with a link), Save publishes and pops the share link.
- Respondent page: start card, chat, results on completion, review ask with a maybe-later, everything posted to the store with an outbox retry.
- Dashboard: account tiles, Verified stats (every publishable number across surveys, each linked to its survey), survey rows with a publish-readiness meter and status, click for an overlay with actions and numbers.
- Results: per-survey analytics plus every answer (names, emails, country, review outcome) on the private link.
- Scan: one page, real agent, drafts land in the editor.
- Onboarding: first-run panel, optional four-step tour, help replay, one tip per view.
- Contrast AA, reduced-motion safe, measured acceptance suites (mobile 13 checks, live 21 checks) all green.

## What is yours

1. **Database.** The store today is two Supabase tables with the full record as jsonb, written through PostgREST with merge-duplicates upsert. Works, but every read is "fetch everything, filter in Python". When response volume grows, a normalized read model (answers as rows, indexed by survey and question) and a proper aggregate query replace `_fetch_latest` and the aggregation loop in `survey_results`. The contract doc is the input; the endpoints above are the interface the frontend depends on, so keep their response shapes.
2. **HubSpot write-back.** Not started, blocked on a private app token. The plan that was greened is in `completion-backend-spec.md`: per-survey completion property (`sr_completed__<survey_slug>`, datetime), a timeline note, and the workflow goal set to "is known" so reminders stop. Anonymous responses never write to HubSpot. The respondent record already carries `respondent.name` and `respondent.email` when the survey requires them, plus `client_response_id` for idempotency.
3. **Identity tokens** (`?t=` HMAC links tied to a HubSpot contact) are specified in the same doc and not built. Only needed once HubSpot is in.

## Things to know before touching the backend

- Read `fly logs` first when something looks degraded. Five deploys were spent once diagnosing a bug the logs named in the first line.
- The response write is a CORS simple request by design. Any header you add to a browser-facing endpoint needs to be in `allow_headers` in `main.py` (X-SR-Admin-Key already is).
- factor8 has two machines. Anything that writes to local disk splits across them; that is why storage moved to Supabase. Do not add file state.
- Tests: `uv run pytest tests/test_survey_rocket.py -q` (offline, 34 pass). `uv run ruff check` before pushing. Branch from `origin/main`, PR, squash merge, then `gh workflow run fly-deploy.yml`.
- The frontend loads `assets/styles-shared.css`, then each page's inline block, then `assets/styles-app.css` last. That order is deliberate: the app layer wins ties.

## Open items nobody owns yet

- Landing page: five product-screen placeholders and two video slots need real captures (Kevin).
- "Talk with our team" on the landing page: Kevin to decide.
- The demo page claims "nothing you type is stored"; free-text answers do pass through the judge endpoint. Confirm the judge logs nothing before that line stands.

## Contacts

Ralph owns the product and the frontend. Kevin owns the direction. The two verification suites are in `scripts/`: `accept_mobile.py` (local, 390x844, reduced motion on) and `accept_live.py <admin key> <shots dir>` (against the deployed pages). Both need `pip install playwright` and `playwright install chromium`.
