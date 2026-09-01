# Survey Rocket question schema, v1

**Pinned 2026-09-01.** The one shape for a survey. Three producers write it
(the editor by hand, the Designer agent from a scan or a stat, a cloned
template) and everything else reads it: the chat engine, the turn endpoint,
the response record, the dashboard, and Edward's database.

Before this document there were three diverging shapes for the same thing.
Do not add a field anywhere without adding it here first and bumping the
version.

```
{
  "schema_version": 1,
  "id":       string,              // stable forever. never renamed; responses reference it
  "name":     string,
  "cadence":  string | null,       // display only
  "status":   "Draft" | "Active" | "Paused",
  "intro":    string | null,       // null = the engine's default line
  "outro":    string | null,

  "settings": {
    "require_contact": boolean,    // ask name + email before the questions (Kevin 8/31)
    "show_results":    boolean,    // respondent sees the aggregates on completion (Kevin 8/31)
    "review_ask":      boolean,    // then ask for a review (Kevin 8/31)
    "review_links":    { }         // platform -> url, RepRocket's shape. {} = nowhere to send
  },

  "questions": [
    {
      "id":       string,          // unique within the survey, stable forever
      "type":     "choice" | "multi" | "number" | "text",
      "q":        string,          // asked VERBATIM. never paraphrased at runtime
      "options":  string[],        // choice + multi only
      "nps":      boolean,         // choice only: renders the 0-10 strip
      "min":      number,          // number only
      "max":      number,          // number only
      "unit":     string | null,   // number only, shown not parsed
      "optional": boolean          // text only: the word "skip" moves on
    }
  ],

  "provenance": {
    "source":      "hand" | "scan" | "stat" | "template",
    "drafted_by":  string | null,  // model id when source is scan or stat
    "approved_by": string | null,  // a person. NEVER null on an Active survey
    "approved_at": ISO8601 | null
  }
}
```

## Rules that travel with it

1. **`q` is asked verbatim.** Kevin's standing rule, and the reason the
   Interviewer agent is never handed authority to emit a question.
2. **`approved_by` is never null on an Active survey.** Drafts from the
   Designer stay Drafts until whoever is using the editor saves them. No
   review queue; the operator approves.
3. **Question `id`s are stable forever.** Renaming one orphans every stored
   response that references it. Add a new question instead.
4. **Old records without `schema_version` are v0.** Readers upgrade them on
   read (`upgradeSurvey` in `js/store.js`): missing `settings` get the
   defaults below, missing `provenance` becomes `{source:"hand"}`.
5. **Defaults:** `require_contact` false, `show_results` false,
   `review_ask` false, `review_links` {}. Everything off. A survey opts in.

## What changed from the ad-hoc shapes

- `quoteAsk` is **gone**. Kevin 8/31: "No optional last question please."
  The completion path is now results + review ask, driven by `settings`,
  not a quote flow bolted to the end of the script.
- The demo script in `index.html` and the seeds in `js/store.js` now carry
  this shape rather than their own.
