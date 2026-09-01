# Survey Rocket v1 build plan

**Written 2026-09-01.** Covers everything Kevin asked for in the 31 Aug thread (text plus his audio note) and everything Ralph has asked for since. Supersedes the ordering in `agents-spec.md`, which was written before Kevin's review.

Kevin's verdict was **green for v1**, so nothing below is a rebuild. It is one dependency chain plus four batches of work hanging off it.

**Patched 2026-09-01, second pass.** The first draft missed four things: Kevin's annotated screenshot was never actually read (image reads were blocked in the session that drafted this), so his image feedback is uncaptured; his "show them the results" quietly reverses a decision this project recorded in writing; the plan never said WHICH of the three surfaces each change lands on; and the admin view was scheduled last when Kevin's own reason for wanting it argues for showing him a rough one first.

**Open risk, before any Phase 2 work:** open Kevin's screenshot (file F0BULCU5UEL in the 8/31 thread) on a machine that can render it and check nothing there contradicts this plan. Everything below is built from his text and audio only.

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
  show_results:       boolean      // respondent sees the aggregates on completion
  review_ask:         boolean      // show the review step on completion
  review_links:       { platform: url }   // per client, same shape RepRocket uses
}
```

**1.2 `POST /v1/responses`.** One day. On factor8, not a new service: it already has a mounted 1GB volume that survives restarts, the public-path pattern from `aeo-scan/lead`, and the rate limiter. Append-only JSONL, no database, no migrations. The server stamps `submitted_at`, resolves country from the request IP, and hashes the IP.

**1.3 `survey.html` posts on completion.** Half a day. `onComplete` already fires at the right moment and `js/hubspot.js` becomes the transport instead of a stub. Failure goes to a local outbox and retries; a respondent never sees an error.

**1.4 Auth on the READ endpoints, not the page.** Half a day, and it ships in this phase, not after. A static Pages site cannot password-protect itself, so the protection lives where it can: every endpoint that reads responses requires an admin key header, `app.html` asks for the key once and keeps it in its own localStorage, and a wrong key shows an empty dashboard rather than an error oracle. The page stays public and empty-handed; the data does not. The write endpoint stays public and rate-limited like the turn endpoint, because respondents have no key and never will.

---

## Phase 2. Kevin's respondent changes. About a day.

**2.1 Drop the optional last question.** His words: *"No optional last question please."* The quote-with-permission flow comes out of the respondent path.

**2.2 New ending: results, then the review ask.** *"upon completion, we should show them the results and then ask them to leave a review (if it's turned on it'll have that option here)."* Results gated on `settings.show_results`, the review step on `settings.review_ask`.

**This reverses a decision on the record, and the record has to move with it.** The respondent-flow wireframe and its pass log both state, deliberately, that a real respondent never sees a dashboard, which is why the wireframe's last step says "All Set" while the demo says "Your Dashboard". Kevin's "show them the results" overturns that for surveys with the toggle on. Not a silent patch: update the wireframe's final step to results plus the review ask, and note the reversal in `copy-gate/passes/2026-08-26-surveyrocket-respondent-flow.md` with Kevin's quote as provenance, so the next person does not "fix" the wireframe back.

**2.3 New primary CTA**, his wording: *"thanks so much for submitting this data. would you be open to leaving us a review?"*

**2.4 Remove "Talk with our team."** *"let's not have that yet."*

**2.5 Demote "Start over."** *"that's not like a primary call to action."* Keep it as a quiet secondary; his worry was that it reads like it might wipe their session.

**2.6 Name and email capture**, shown only when `settings.require_contact` is on.

**2.7 Which surface each change lands on.** The first draft never said, and the three pages are easy to conflate:

| Change | Demo (`index.html`) | Respondent (`survey.html`) | Landing |
|---|---|---|---|
| Drop optional last question | yes | yes | n/a |
| Results + review ending | yes, always on (it is the pitch) | per-survey toggles | n/a |
| Remove "Talk with our team" | yes, the dashboard CTA | n/a | **ask Kevin** |
| Demote "Start over" | yes | yes | n/a |
| Name/email capture | no, demo stays frictionless | when toggled | n/a |

The one ambiguity: "Talk with our team" also appears twice on the landing page as gated deck copy. Kevin was reviewing the demo when he cut it, and he greened "overall", so the landing CTAs probably survive, but removing them there means re-gating the deck. One-line question to him, not a guess.

**Worth raising with Kevin before building 2.1 and 2.2.** Ending on a review ask is Reputation Rocket's job. This makes Survey Rocket collect the data and then hand off to RepRocket's flow, which is a real product decision rather than a copy change, and it retires the quote-with-permission work. Confirm it is deliberate. If it is, the two products should share that ending rather than each owning a copy of it.

---

## Phase 3. Real agents in the app. About a day.

**3.1 Wire "Find my gaps" and "Start from a stat."** `runScanSteps` prints hardcoded strings on a 450ms timer and reveals a `DRAFTS` object written by hand. It says "Found 11 published claims" whatever URL you type, because it never reads one. The real agent is deployed at `POST /api/v1/survey-rocket/scan` and has already read six pages of lean-labs.com and found four genuine gaps.

Two things the fake version did not have to handle: the real scan takes about 52 seconds, so the progress log stops being decorative; and the endpoint is authenticated, which is fine once 1.4 puts the app behind auth.

**3.2 Drafted questions land in the editor** as an editable draft, never live. `approved_by` stays null until a person saves it.

---

## Phase 4. The admin view. About a day and a half.

Kevin asked for this directly: *"we're gonna need like an admin view. I need to see an admin view. Of what this looks like, OK? That way we know that we're building the right thing."*

Note the reason he gave: he wants it to check that the right thing is being built. A validation tool that arrives after everything is built has failed at its own job.

**4.0 Rough mock to Kevin first, and it does not wait for the spine.** The seed data in `SRStore` is enough to render a submissions list with fake names, countries and timestamps. Build the screen against seed data while Phase 1 is in flight, screenshot it, send it with one line: is this the admin view you meant? His calendar latency costs nothing while it overlaps the spine build, and his answer can reshape 4.1 and 4.2 before they are built rather than after.

**4.1 Submissions list.** One row per response: when, country, name and email if captured, whether the review was asked and what happened, and the answers behind a click.

**4.2 Per-survey settings.** The two toggles from 1.1 plus the review links. Today's Settings screen is a read-only status display.

**4.3 Export.** The dashboard already has "Copy all as JSON"; this is the same thing against real data.

---

## Order and why

```
Phase 0    →  Edward, today, 30 min
Phase 1    →  the spine, ~2 days      nothing else starts without it
Phase 4.0  →  admin MOCK to Kevin     IN PARALLEL with phase 1, seed data only
Phase 3    →  real agents, ~1 day     independent of phase 2, best demo value
Phase 2    →  Kevin's flow changes    2.1/2.2 need his confirmation + the screenshot check
Phase 4    →  admin view, ~1.5 days   wired to real data, shaped by mock feedback
```

About five and a half days of build against a hard ceiling: Kevin's internal drop-dead is 15 Sep, two weeks out, so the runway is real but not generous. Phase 3 sits before Phase 2 deliberately: it depends only on the spine, it removes the only screens in the product that lie, and Phase 2's two biggest items are waiting on an answer from Kevin. The admin mock rides alongside Phase 1 because it needs nothing from it.

## Verification, per phase

The repo's own rule applies: nothing is done until verified in a real browser against the deployed URL, because curl codes and HTML greps lie, and the localhost harness cannot reach the agents at all (factor8's CORS allow-list names the Pages origin only).

- **Phase 1:** pytest on the endpoint (schema validation, rate limit, admin-key gate, IP hashing); then one answer submitted from the deployed `survey.html` on one machine appearing in `app.html` on another. That cross-device read is the whole point, and it is the acceptance test.
- **Phase 3:** deployed gap scan run against a site that is NOT lean-labs.com, drafts landing in the editor as editable, and the 52-second wait showing real progress rather than theatre.
- **Phase 2:** Playwright walk of the demo and respondent paths, both toggle states each; re-gate any page whose copy moved.
- **Phase 4:** Kevin looks at it and says it is what he meant. That was his stated purpose, and no other check substitutes.

## Still out of scope, and still blocked on the same question

HubSpot write-back, identity tokens and the NFI clone. All specced in `completion-backend-spec.md`, all parked, and all waiting on one unanswered question: whether the client's reminder emails are a contact-based workflow or a Sales Hub sequence. A sequence has no goal concept, so "the completed property stops the reminders" cannot work as written.
