# Survey Rocket

Turn customer surveys into stats you can publish. Survey Rocket asks your questions in a chat and rolls the answers into running averages your team reads live.

Live: https://leanlabs0.github.io/survey-rocket/

## Pages

| Page | What it is |
|---|---|
| `index.html` | Public site: landing + a sandboxed live demo (you play a Lean Labs client, nothing stored) |
| `app.html` | The client app: Surveys, the question editor with live chat preview, one Scan-my-site screen backed by the real gap-scan agent, server-backed Results (analytics + every answer), Settings with the admin key connect gate, and opt-in onboarding (first-run panel, five-step tour, per-view tips) |
| `survey.html` | The respondent page. `?id=<survey>` fetches the published definition from the server, so one link serves the newest save on any device; legacy `#p=` links keep decoding forever |

## What is real

- **The chat engine** (`js/engine.js`): tap answers, judged free text (a live server-side agent extracts the number a human would hear), a two-probe budget so nobody gets nagged forever, one deduped hint bubble per question.
- **The response spine**: every completed survey posts to the factor8 shared store (`POST /public/survey-rocket/responses`), with a localStorage outbox retry. Results reads the same store back through the admin key. Respondent-facing aggregates come from the public results endpoint.
- **Publishing**: Save in the editor persists locally and `PUT`s the definition to factor8, which is what `survey.html?id=` serves.
- **The scans**: one screen, optional target stat, calling the real designer agent on factor8 (admin key required). Drafts land in the editor as editable Drafts, never live.

## Still pending

- **HubSpot write-back**: contact properties, timeline note, completed flag ending the reminder workflow. Blocked on a private app token.
- **Landing page media**: the product-screen figures and the two videos are placeholders awaiting real captures.

## Structure

```
index.html  app.html  survey.html
assets/styles-shared.css   design tokens + shared primitives
assets/styles-app.css      the app layer shared by app.html and survey.html
js/engine.js               the chat engine (config in, answers out)
js/store.js                survey working copies in localStorage (responses never live here)
js/hubspot.js              transport: response post, outbox, results + published-survey fetch
docs/                      question schema, response contract, backend spec, build plans
```

## Running the Lean Labs pilot

1. Open `app.html`, paste the admin key in Settings (Lean Labs issues it).
2. Review the seeded "Client outcomes" survey in the Editor, hit Save to publish it.
3. Copy link, send it to a teammate, have them answer on their device.
4. Watch Results move as answers land.

A Lean Labs product.
