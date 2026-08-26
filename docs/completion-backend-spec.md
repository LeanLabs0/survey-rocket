# Survey Rocket: completion signal backend

**Spec v1.** Ralph, 2026-08-26. **Status: proposed, not built.**
Covers ClickUp 868ku8ucw "Build Functioning AI Agent" (was due 21 Aug). Target is the NFI launch, 11 Sep, with Kevin's internal drop-dead at 15 Sep.

**Scope guard.** This is built in a new repo alongside `LeanLabs0/survey-rocket`. It is not a Factor8 skill and does not belong in `factor8-agent-sdk`, `ll-mcp-app`, or `AIS-OS`.

> **Phasing, set 2026-08-26.** Survey Rocket is being built for Lean Labs first. NFI comes after Kevin approves the prototype. Everything in this document that depends on a client's HubSpot portal, a signed identity token, or the 11 Sep NFI date is **phase 2** and is not on the current critical path. The phase 1 build is in `agents-spec.md`.

**Honest limitation, up front.** No HubSpot private app token exists for this yet. Until one lands, none of this can be tested against a real portal, and nothing here should be described to a client as verified. Section 8 gives the free path to a real test.

---

## 0. What is true today

Verified by reading the repo, not from memory.

| Fact | Where |
|---|---|
| `onComplete(answers)` already fires after the outro is on screen | `js/engine.js`, inside the `_bot(outro, cb)` callback in `_finish` |
| Quote fields ride inside the same `answers` object, `_` prefixed | `_quote`, `_quotePermission`, `_quoteAttribution` |
| `_quotePermission` is a real tri-state | `approved`, `declined`, `private feedback` |
| `private feedback` is set automatically by the sentiment gate, and the permission question is never asked | the `isNegative` branch of the quote phase |
| The share payload is unsigned base64 and carries the real survey id | `js/store.js`, `encodeShare` |
| `SRHubSpot.writeBack()` is a `console.info` returning `{status:"pending"}` | `js/hubspot.js`, `enabled: false` |
| No token scheme exists. Settings says "Contact token: Comes with the HubSpot phase" | `app.html` |
| The survey page is on GitHub Pages, a different origin from any backend | `README.md` |
| A Restart button lets one person complete twice | `survey.html` |
| **NPS type inconsistency.** The engine records the option label as a string, the seed data stores an integer. The prototype dashboard only survives it by calling `parseInt` | `js/engine.js` vs `js/store.js` |

---

## 1. The completion request

**Nothing in `engine.js` changes.** The only wiring point is `survey.html`'s `onComplete`, which the engine already calls after the outro bubble renders. The last tap is the signal because the last tap is what advances into `_finish()`.

**One simple CORS request, no preflight:**

```
POST /v1/responses
Content-Type: text/plain;charset=UTF-8
keepalive: true
```

Three deliberate choices:

`text/plain` rather than `application/json` makes this a CORS simple request. No preflight round trip, and the write still reaches the server even if CORS is misconfigured, because CORS only gates the browser reading the reply. The server parses the raw body itself.

`keepalive: true` means the request survives the tab closing right after the last tap.

**Never awaited before a UI change**, because there is no UI change left. The outro is already on screen.

### Payload

| Field | Type | Req | Notes |
|---|---|---|---|
| `schema_version` | int | yes | `1` |
| `client_response_id` | uuid v4 | yes | minted at chat start, the idempotency key |
| `survey_id` | string | yes | **untrusted claim** when anonymous |
| `survey_name` | string | no | display only, never used for logic |
| `token` | string or null | yes | `null` means anonymous |
| `source` | `email` or `share` | yes | `email` when `?t=` was present |
| `completed_at` | ISO8601 | yes | client clock, advisory. Server clock wins |
| `answers` | object, max 40 keys | yes | |
| `quote.text` | string, max 2000 | no | |
| `quote.permission` | enum | if quote | rejects anything outside the tri-state plus `none` |
| `quote.attribution` | string, max 200 | no | meaningful only when approved |

**The easy thing to get wrong:** the client adapter must strip `_quote`, `_quotePermission` and `_quoteAttribution` out of `answers` and lift them into the `quote` object. Left in place, they land in Edward's answer array as if they were survey questions.

### Degradation, so a respondent never sees an error

1. `.catch(() => {})`. There is no error path to the UI, by construction.
2. On failure, the payload goes to `localStorage["sr:outbox:v1"]`, capped at 5.
3. Retry on next page load and on `visibilitychange`.
4. The outbox clears only on a confirmed 2xx, which is why CORS still has to be right even though the write does not depend on it.
5. If they never come back, the response is lost and the reminder keeps sending. **Accepted.** The backstop is the replay endpoint in section 4.
6. **Idempotency.** The server keys on `(survey_id, client_response_id)`. A second arrival returns `200 {"duplicate": true}`. The HubSpot PATCH is naturally idempotent, so a replay is harmless.
7. **A partial completion sends nothing.** Someone who answers four of six and leaves keeps getting reminders. That is correct per the requirement and it is a decision, not an oversight. Written down here so nobody "fixes" it later.

---

## 2. Identity

### Rejected: raw HubSpot contact ID in the URL

HubSpot contact IDs are numeric and roughly sequential inside a portal. One leaked link lets someone iterate neighbouring IDs and, for every contact in the client's database: mark them complete so their reminders stop, inject fabricated answers into the published stat, and submit a quote with permission already set to approved and any attribution they like. The blast radius is the whole portal, from one link. Zero engineering cost, unbounded risk.

### Rejected: email address in the URL

Worse. PII in every server log, and upsert-by-email lets someone create contacts that never existed, polluting the client's CRM rather than just their stats.

### Chosen: an opaque HMAC-signed token

`?t=v1.<payload>.<sig>` where the payload is base64url `{cid, sid, exp, v}` and the signature is HMAC-SHA256 with a server-held secret. Stateless, so verification needs no database, which is what keeps this small.

The payload is **readable but not encrypted**, on purpose. The property that matters is unforgeability, which HMAC gives. Encrypting would only hide a contact ID from the person who already holds their own link, at the cost of much harder debugging. Say that out loud so nobody mistakes readable for insecure.

**Costs, plainly:**

- HubSpot email templates render properties, they cannot compute an HMAC. So the token must be on the contact before the email sends. That is the mint job.
- One extra contact property, `sr_survey_url`.
- A secret to hold and rotate. `SR_TOKEN_SECRET` accepts a list, current plus previous, so rotation does not kill live links.
- **Forwarding still works.** A forwarded token lets the recipient answer as the original contact. Mitigated by a 90 day expiry, comfortably past the reminder cadence, and by the blast radius being exactly one contact. Single-use would need server state; deferred until Edward's database exists, at which point it is a one-column change.

**Query param, not fragment.** A fragment never reaches a server and would be cleaner in principle, but HubSpot rewrites every email link through its click-tracking redirect and fragment survival across that redirect is not something to bet a launch on. Query params always survive. **Smoke-test this with one real HubSpot email before launch.**

`survey.html` calls `history.replaceState` right after reading the token, so the visible URL, screenshots and the back button do not carry it. Add `<meta name="referrer" content="no-referrer">` while you are in there, since the page loads Google Fonts. The server logs `sha256(token)[:12]`, never the raw token.

**Trust rule:** for identified submissions, `survey_id` comes from inside the signed token, never from the request body. The `#p=` share payload is unsigned base64, so anyone can edit it and claim any survey. The token is the only trustworthy statement in the request.

---

## 3. The anonymous path

Same endpoint, `token: null`, `source: "share"`. No separate route, because a separate route is a separate thing to secure.

**No HubSpot write, ever.** There is no contact, and an anonymous submission can never become identified: the contact ID only ever comes from a verified token. Expired and invalid tokens are treated as anonymous and still return 200, so the respondent never learns anything went wrong.

**Counting rule, and it is a product decision.** Published stats are computed over `counted == true` only. Anonymous responses sit in a separate bucket and never roll into a headline number. The reason is the product thesis: Survey Rocket exists to produce publishable authority stats. A number anyone can move with a script is not publishable, and shipping one would expose the client.

**Anti-spam, without a second request:**

| Control | Setting |
|---|---|
| Body cap | 32 KB, rejected at the ASGI layer |
| Shape caps | 40 answers, 2000 chars per text answer, 200 char attribution |
| Survey allow-list | unknown `survey_id` gets a `202` and is dropped silently, so there is no error and no oracle |
| Anonymous rate limit | 5/hour, 30/day per IP |
| Identified rate limit | 10/hour per IP, 3 per token |
| Per-survey daily anonymous cap | 200/day. Above it, responses are **accepted and quarantined**, never rejected |
| No read API | there is no `GET /v1/responses`, so the endpoint cannot leak anything |

Quarantine over rejection throughout: a respondent must never see an error, and an attacker should not learn they are being filtered.

Deliberately not doing: CAPTCHA (breaks the one-tap promise), proof of work (breaks "one request"), a session-start endpoint (breaks "one request", and it was tempting).

---

## 4. The HubSpot write

**Contacts v3 property update**, `PATCH /crm/v3/objects/contacts/{id}`.

Rejected alternatives, and why:

- **A custom object for responses.** Duplicates Edward's database, needs schema creation in every client portal, and cannot drive a contact workflow goal directly.
- **Custom behavioral events.** Require Marketing Hub Enterprise. Lean Labs' own portal has it; assuming a client does is a launch-week landmine.
- **Timeline event templates.** App-scoped, need versioning against an app ID, and there is no working precedent for them anywhere in the org.
- **A Note on the contact.** *Accepted as an optional second write.* Works on any tier with a private app token, renders in the timeline, and preserves the "you can see the answers on the contact record" experience Kevin greened on 7/29 without exploding the property schema. Best-effort: if the note fails, the completion still succeeded.

### Properties

All names below are **proposed**. No HubSpot property exists for this in any portal yet. The full list, with types and the admin steps, is in `hubspot-portal-checklist.md`.

The one that carries the design: **`sr_completed__<survey_slug>`, a datetime, one per survey.** A single global flag breaks silently the moment a contact is enrolled in a second survey, and the prototype already seeds two. They would meet the second workflow's goal at enrollment, unenroll instantly, and never receive the email. It presents as "the second survey just doesn't send" and costs a day to find. One property per survey costs one extra API call on first write and removes the whole class of failure.

**Not written: individual answers as contact properties.** That is one property per question per survey in the client's portal, which is the schema explosion an admin will refuse, and it is Edward's territory. The human-readable summary goes in the Note instead. **This is a change from what Kevin saw on 7/29**, and it has to be said in the Loom rather than discovered later.

### The goal

A contact-based workflow with the goal set to `Survey Rocket completed: <name>` **is known**, plus the same filter as an unenrollment trigger. Full steps in the checklist.

`is known` rather than `equals`: idempotent, no value parsing, hardest to misconfigure.

### Reliability

Retry with exponential backoff, **no retry on 4xx** (a 4xx means the request is wrong; retrying burns rate limit). Behind `SR_HUBSPOT_ENABLED`, dark by default. Never throws into the request path. Failures post to Slack.

**Reconciliation:** every stored response carries `hubspot.status`. `POST /admin/replay` re-attempts every failed row. Roughly twenty lines, and it is the difference between a two-hour HubSpot outage being a shrug and being a dozen customers getting reminders after they already answered.

---

## 5. Where answers live

Covered in full by `response-contract.md`, which is the document to send Edward.

Short version: append-only JSONL on a Fly volume plus one structured log line per response. No database, no ORM, no migrations. That is the literal reading of "storage can wait", it survives restarts, it is greppable during launch week, and `GET /admin/export?since=<iso>` lets Edward backfill in one command.

---

## 6. Deployment

**FastAPI on Fly.io, new repo `LeanLabs0/survey-rocket-api`, PRIVATE, app `survey-rocket-api`.**

The org already runs `factor8-agent-sdk`, `domain-agents` and `fan-out-engine` there. `fan-out-engine`'s `fly.toml` and Dockerfile copy across verbatim. Ralph has the account, the CLI and the muscle memory. A few dollars a month.

Rejected: a serverless function adds a new deploy target, secret store and runtime to reason about for one endpoint, two weeks before a client launch, and the saving is not real. A Supabase edge function would couple this to a datastore decision that is Edward's and has not been made. Folding it into `aeo-tools` or `ll-mcp-app` couples the launch to an unrelated release train and mixes Lean Labs' portal token into the same process as a client's.

Not inside `LeanLabs0/survey-rocket`: that repo is public and serves Pages from root, so every file in it is downloadable by anyone. The repo must be private, because it holds the agent system prompts (see `agents-spec.md`), the token-minting logic, and the HubSpot integration.

`min_machines_running = 1` for the launch window, then back to 0. The respondent never waits on the response, but a cold start plus keepalive plus a flaky network is three things stacking in the one week where it must not fail.

**Secrets**, all via `fly secrets`, never in the repo and never in a URL: `SR_TOKEN_SECRET`, `SR_ADMIN_KEY`, `SR_IP_SALT`, `SR_CLIENTS`, `HUBSPOT_TOKEN_NFI`, `SR_HUBSPOT_ENABLED`, `SR_ALLOWED_ORIGINS`, `SLACK_WEBHOOK_URL`.

---

## 7. Security

**CORS is not authentication here.** Because the write is a simple request, a browser sends it regardless of CORS; the header only controls whether the page can read the reply. Authentication is the HMAC token, full stop. CORS exists so the outbox can confirm delivery and stop retrying. Allow-list `https://leanlabs0.github.io` plus the future custom domain, never `*`.

**What someone with a leaked survey link can do:**

| Attack | Possible | Impact | Control |
|---|---|---|---|
| Complete as that contact | Yes | that one contact's reminders stop | accepted, blast radius is one |
| Inject false answers for that contact | Yes | moves a stat by one response | accepted at n=1, rate limit caps repetition |
| Submit a fabricated approved quote | Yes | **worst case: a fake testimonial on the client's website** | **human approval before publication. This is the control that matters** |
| Enumerate other contacts | No | | HMAC. This is the whole reason for section 2 |
| Read any stored response | No | | there is no read endpoint |
| Create contacts in the CRM | No | | never upserts by email, only patches an ID from a verified token |
| Mark arbitrary contacts complete | No | | needs a forged signature |
| Extract the HubSpot token | No | | server-side only, never in the page |

The pattern: damage is bounded to one contact and one response, and the one genuinely dangerous outcome is blocked by process rather than code, because process is the only thing that reliably stops it.

---

## 8. Testing without the production portal

**A free HubSpot developer test account.** `app.hubspot.com/developers`, create a developer account, then Test accounts, then create one. Test accounts expose the higher-tier features including workflows with goals, which is the mechanism that cannot be proven any other way. A private app can be created inside it, producing a real token against a real portal. Zero cost, under an hour.

A HubSpot sandbox was the alternative but needs an Enterprise parent portal, which is not confirmed. The developer test account has no such prerequisite.

**Tiers:**

1. **No network.** Token mint and verify: valid, tampered payload, tampered signature, expired, wrong secret, rotated secret accepted. Payload validation, the `_quote` lift, NPS normalization, idempotency, rate-limit boundaries.
2. **Stubbed HubSpot.** Assert the exact PATCH path and body, the property-ensure path, no retry on 4xx, backoff on 5xx, and that a HubSpot failure never propagates into the response.
3. **Developer test account, end to end.** Three contacts. Run the mint, confirm `sr_survey_url` is populated, complete the survey **in a real browser served from the GitHub Pages origin** because that is the only way to prove no-preflight plus keepalive plus cross-origin work together. Watch the datetime land, watch the goal fire, watch the contact leave the workflow. Send one real HubSpot email to confirm the click-tracking redirect preserves `?t=`.
4. **Playwright.** Last tap fires exactly one POST. The outro is on screen before it resolves. A forced 500 produces no visible error. The outbox retries on reload and clears on success. An anonymous link sends `token: null`. The token is gone from the visible URL. Restart produces a duplicate the server collapses.

### The Kevin handover

A Loom of about five minutes: the email in the test portal with the per-contact link visible on hover, the click through and the chat, the contact record showing the completion datetime and the note, the workflow showing the contact removed and the goal counted, then the anonymous share link completing with the contact record untouched. Close on the honest line: **tested in a HubSpot developer test account, not in the client's portal. Their portal still needs the checklist run and a token issued.**

Package: the portal checklist, the response contract, a network-tab screenshot of one request and a 2xx, a second of a forced failure with a clean chat, the token and secret runbook, and the known limitations in writing (forwarding, partial completions, anonymous responses excluded from published stats, and the answer-properties change from the 7/29 preview).

---

## 9. Build order

Twelve working days to 11 Sep for about seven days of work. The slack is deliberate, because the token arrival date is not under our control. Every token-dependent step is sequenced last.

| # | Step | Effort | Blocked by |
|---|---|---|---|
| 0 | Confirm the client's hub tier and whether reminders are a workflow or a sequence. Request the token. Create the developer test account | 0.5d | nothing. **Do today** |
| 1 | Repo and deploy skeleton on Fly, `/health`, CORS | 0.5d | 0 |
| 2 | Token mint and verify, unit tested | 0.5d | 1 |
| 3 | `POST /v1/responses`: validation, quote lift, NPS normalization, idempotency, rate limiting, JSONL, structured log | 1d | 2 |
| 4 | Client wiring in `survey.html` and `hubspot.js`. **No `engine.js` change** | 0.5d | 3 |
| 5 | HubSpot client: ensure-property, PATCH, note, backoff, Slack alert, behind the flag | 1d | 0 |
| 6 | Mint job | 0.5d | 5 |
| 7 | End to end in the test account, including building the workflow and proving goal unenrollment | 1d | 5, 6 |
| 8 | Portal checklist and response contract | 0.5d | **deliver to Edward by 1 Sep even if the rest slips** |
| 9 | Loom and handover for Kevin | 0.5d | 7, 8 |
| 10 | Swap in the client's real token, run the checklist in their portal, one internal test contact, launch | 0.5d | **their token.** The only step that cannot start early |

**Critical path note:** step 8 has an earlier hard deadline than the launch. Edward's tasks are due 2 Sep and he cannot design a schema against a contract he has not seen. Both documents are written already and should go to him now.

### Not in scope

AI question generation and the strategy agent (Kevin parked it on 3 Aug: "I'm not trying to make a strategy agent before we even build one implementation"). The site scan flows, which are labelled later-phase previews. The dashboard and shared database, which are Edward's. Answer-level HubSpot properties, custom objects, behavioral events, timeline event templates. Multi-tenant onboarding UI. Partial-completion signals. Editing a submitted response. Email template design. Authentication for `app.html`. A custom domain.

---

## 10. Genuinely unknown, with owners

1. **Are the client's reminders a contact-based workflow or a Sales Hub sequence?** A sequence has no goal, so the requirement cannot be met as written and the reminders need rebuilding. **The biggest launch risk in this document, and one question answers it.** Owner: Edward, ClickUp 868ku8uz0.
2. **Is the private app token for the client's portal or Lean Labs'?** Almost certainly the client's, since the contacts are theirs, which also decides who runs the checklist. Owner: Ralph, to confirm.
3. **Edward's datastore, and push or pull.** Owner: Edward. Not blocking, the contract is storage-agnostic.
4. **Does Kevin still expect answers as properties on the contact record?** He greened that on 7/29 and this spec substitutes a note. Owner: Ralph, decide and say it out loud.
5. **Does HubSpot's click tracking preserve `?t=`?** Expected yes, must be smoke-tested. Owner: Ralph, during step 7.
