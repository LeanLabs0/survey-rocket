# Survey Rocket, working prototype

Turn customer surveys into stats you can publish. Write your questions or start from a stat and let a scan draft them, approve everything, and Survey Rocket asks them in a chat while the answers roll into running averages on a dashboard.

Live: https://leanlabs0.github.io/survey-rocket/

## Pages

| Page | What it is |
|---|---|
| `index.html` | Public site: landing + a sandboxed live demo (fictional company, nothing stored) |
| `app.html` | The client app, seeded as the Lean Labs test account: Surveys, a working question editor with live chat preview, per-survey Dashboards computed from responses, Settings |
| `survey.html` | The respondent page. `?id=<survey>` opens a survey from this browser; `#p=<payload>` carries the whole survey inside the link so it works on any device (use "Copy share link" in the editor) |

## Test phase, what is real and what is not

**Real:** the editor (add, edit, reorder, delete questions, types, validation), saving (persists across reloads), the chat engine (tap answers, validated numbers, optional skip, quote ask with sentiment gate), and the dashboards (computed live from stored responses, seeded samples labeled).

**Not yet:**
- **Storage is this browser only** (localStorage). The share link carries the survey to any device, but answers stay on the answerer's device. Phase 2 adds a shared data store so responses aggregate across devices.
- **HubSpot write-back is stubbed** (`js/hubspot.js`). The real version calls a server-side endpoint with a private app token: contact properties, a timeline note, and a completed flag that ends the reminder workflow. Wired when the token lands.
- **The two scan flows** (Find my gaps, Start from a stat) are labeled previews of a later phase. They demo the flow with canned results; drafts they create are real editable surveys.

## Structure

```
index.html  app.html  survey.html
assets/styles-shared.css   design tokens + shared UI (Lean Labs design system)
js/engine.js               the chat engine (config in, answers out)
js/store.js                localStorage store + seed data (swap point for phase 2)
js/hubspot.js              write-back stub (swap point for the token)
```

## Running the Lean Labs test

1. Open `app.html`, review the seeded "Client outcomes" survey in the Editor.
2. Copy share link, send it to a teammate, have them answer on their device.
3. Answer it yourself in this browser too, then watch Dashboard move.
4. Reset any time: Settings, "Reset to seed data".

A Lean Labs prototype. Function first, styling after.
