# Survey Rocket v1 build plan

**Written 2026-09-01.** Covers everything Kevin asked for in the 31 Aug thread (text plus his audio note) and everything Ralph has asked for since. Supersedes the ordering in `agents-spec.md`, which was written before Kevin's review.

Kevin's verdict was **green for v1**, so nothing below is a rebuild. It is one dependency chain plus four batches of work hanging off it.

---

## The one thing everything depends on

Kevin asked for five things that sound like UI: require name and email, capture IP, capture country, capture date and time, and an admin view. Ralph asked for two: real agents, and a prototype that works without a database.

**Every one of those needs the same missing piece: a response has to leave the respondent's browser.** Today it does not. `SRStore` writes to localStorage, so a customer answering on their phone leaves the data on their phone and the client's dashboard never sees it.

Two of Kevin's asks force this specifically:

- **IP and country cannot be captured in the browser.** A page cannot reliably learn its own public IP, and country is derived from it. Only the receiving server sees them.
- **An admin view of submissions is a view of nothing** until submissions exist somewhere shared.

So the spine is a response endpoint and the record it writes. Everything else is downstream of it, including Edward's database, which reads the same shape.

---

## Phase 0. Unblock Edward. Today, 30 minutes.

His database and HubSpot tasks are due today and the contract he builds against now has new fields.

Update `response-contract.md` to add what Kevin asked for, then send him the file link:

| Field | Source | Note |
|---|---|---|
| `respondent.name` | form, if required | null when the survey does not ask |
| `respondent.email` | form, if required | null when the survey does not ask |
| `meta.ip_hash` | server | see the privacy note below |
| `meta.country` | server | derived from the IP at receipt |
| `meta.submitted_at` | server clock | authoritative, not the browser's |
| `review.asked` | flow | whether the review step ran |
| `review.outcome` | flow | `clicked` / `dismissed` / `not_asked` |

**Privacy note, and it needs a decision rather than a default.** Kevin asked to "capture the IP address". A survey respondent's IP is personal data under GDPR, and these are a client's customers. Proposal: store `country` in the clear, store the IP only as a salted hash so duplicates are still detectable, and never show a raw IP in the admin view. If Kevin wants the raw IP visible, that is a legitimate call but it needs a retention window and a line in the client's privacy policy. **Flag it, do not decide it silently.**

---

## Phase 1. The spine. About two days.

**1.1 Question schema v1.** Half a day. Still three different shapes for one survey: the demo script hardcoded in `index.html`, whatever the Designer emits, and ad-hoc params on the turn endpoint. Nothing in the repo carries a `schema_version`. Pin it, and add the per-survey settings Kevin's changes need:

```
settings: {
  require_contact:    boolean      // name + email, Kevin's toggle
  review_ask:         boolean      // show the review step on completion
  review_links:       { platform: url }   // per client, same shape RepRocket uses
}
```

**1.2 `POST /v1/responses`.** One day. On factor8, not a new service: it already has a mounted 1GB volume that survives restarts, the public-path pattern from `aeo-scan/lead`, and the rate limiter. Append-only JSONL, no database, no migrations. The server stamps `submitted_at`, resolves country from the request IP, and hashes the IP.

**1.3 `survey.html` posts on completion.** Half a day. `onComplete` already fires at the right moment and `js/hubspot.js` becomes the transport instead of a stub. Failure goes to a local outbox and retries; a respondent never sees an error.

**1.4 Auth on `app.html`.** Half a day, and it ships in this phase, not after. The app is a public URL on a public Pages site. That is harmless today because there is nothing behind it. The moment 1.2 lands, real client responses sit behind an unauthenticated public page.

---

## Phase 2. Kevin's respondent changes. About a day.

**2.1 Drop the optional last question.** His words: *"No optional last question please."* The quote-with-permission flow comes out of the respondent path.

**2.2 New ending: results, then the review ask.** *"upon completion, we should show them the results and then ask them to leave a review (if it's turned on it'll have that option here)."* Gated on `settings.review_ask`.

**2.3 New primary CTA**, his wording: *"thanks so much for submitting this data. would you be open to leaving us a review?"*

**2.4 Remove "Talk with our team."** *"let's not have that yet."*

**2.5 Demote "Start over."** *"that's not like a primary call to action."* Keep it as a quiet secondary; his worry was that it reads like it might wipe their session.

**2.6 Name and email capture**, shown only when `settings.require_contact` is on.

**Worth raising with Kevin before building 2.1 and 2.2.** Ending on a review ask is Reputation Rocket's job. This makes Survey Rocket collect the data and then hand off to RepRocket's flow, which is a real product decision rather than a copy change, and it retires the quote-with-permission work. Confirm it is deliberate. If it is, the two products should share that ending rather than each owning a copy of it.

---

## Phase 3. Real agents in the app. About a day.

**3.1 Wire "Find my gaps" and "Start from a stat."** `runScanSteps` prints hardcoded strings on a 450ms timer and reveals a `DRAFTS` object written by hand. It says "Found 11 published claims" whatever URL you type, because it never reads one. The real agent is deployed at `POST /api/v1/survey-rocket/scan` and has already read six pages of lean-labs.com and found four genuine gaps.

Two things the fake version did not have to handle: the real scan takes about 52 seconds, so the progress log stops being decorative; and the endpoint is authenticated, which is fine once 1.4 puts the app behind auth.

**3.2 Drafted questions land in the editor** as an editable draft, never live. `approved_by` stays null until a person saves it.

---

## Phase 4. The admin view. About a day and a half.

Kevin asked for this directly: *"we're gonna need like an admin view. I need to see an admin view. Of what this looks like, OK? That way we know that we're building the right thing."*

Note the reason he gave. He wants it to check the shape of the thing, so it is worth showing him early and rough rather than late and polished.

**4.1 Submissions list.** One row per response: when, country, name and email if captured, whether the review was asked and what happened, and the answers behind a click.

**4.2 Per-survey settings.** The two toggles from 1.1 plus the review links. Today's Settings screen is a read-only status display.

**4.3 Export.** The dashboard already has "Copy all as JSON"; this is the same thing against real data.

---

## Order and why

```
Phase 0  →  Edward, today, 30 min
Phase 1  →  the spine, ~2 days      nothing else can start without it
Phase 3  →  real agents, ~1 day     independent of phase 2, best demo value
Phase 2  →  Kevin's copy changes    fast, but 2.1/2.2 need his confirmation
Phase 4  →  admin view, ~1.5 days   needs real submissions to show
```

About five and a half days of build. Phase 3 is placed before Phase 2 deliberately: it depends only on the spine, it removes the only screens in the product that lie, and Phase 2's two biggest items are waiting on an answer from Kevin.

## Still out of scope, and still blocked on the same question

HubSpot write-back, identity tokens and the NFI clone. All specced in `completion-backend-spec.md`, all parked, and all waiting on one unanswered question: whether the client's reminder emails are a contact-based workflow or a Sales Hub sequence. A sequence has no goal concept, so "the completed property stops the reminders" cannot work as written.
