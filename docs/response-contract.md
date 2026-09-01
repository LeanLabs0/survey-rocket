# Survey Rocket response contract

**For:** Edward, ahead of ClickUp 868ku8up0 (Database & Dashboard) and 868ku8uz0 (HubSpot Connection), both due 2 Sep.
**From:** Ralph. **Date:** 2026-08-26. **Status:** proposed, not yet built.

This is the shape of one stored survey response. Build the dashboard against it. If it needs to change, that is a conversation rather than a silent edit, because the chat engine already produces these values today.

> **Phasing, set 2026-08-26.** Survey Rocket is being built for Lean Labs first. NFI comes after Kevin approves the prototype. Everything in this document that depends on a client's HubSpot portal, a signed identity token, or the 11 Sep NFI date is **phase 2** and is not on the current critical path. The phase 1 build is in `agents-spec.md`.

## The line between us

**Ralph's backend owns the completion signal and an append-only raw response record. Edward owns the database, the aggregation, and the dashboard.**

The backend does not model the data, compute averages, own a migration path, or build a UI. It writes a record and hands it over. Nothing below asks you to change how you store it.

## One response

```
{
  "response_id":        string   // server-generated ULID. PRIMARY KEY.
  "client_response_id": string   // browser uuid. UNIQUE together with survey_id.
  "schema_version":     int      // 1
  "client_id":          string   // "nfi"
  "survey_id":          string
  "survey_name":        string | null
  "source":             "email" | "share"

  "identity": {
    "status":             "identified" | "anonymous" | "expired" | "invalid"
    "hubspot_contact_id": string | null
    "hubspot_portal_id":  string | null
  }

  "respondent": {                    // Kevin 8/31: per-survey toggle
    "name":  string | null           // null when the survey did not require it
    "email": string | null
  }
  "counted":     boolean   // true only when status is identified and not quarantined
  "quarantined": boolean

  "started_at":          ISO8601 | null   // client clock, advisory
  "client_completed_at": ISO8601 | null   // client clock, advisory
  "completed_at":        ISO8601          // SERVER clock. authoritative. sort on this.
  "duration_ms":         int | null       // advisory, forgeable

  "answers": [                            // ORDERED ARRAY, not a map
    {
      "question_id":   string
      "question_text": string | null
      "type":          "choice" | "multi" | "number" | "text"
      "nps":           boolean
      "value_text":    string | null
      "value_number":  number | null
      "value_list":    string[] | null
      "skipped":       boolean
    }
  ]

  "quote": {
    "text":        string | null
    "permission":  "approved" | "declined" | "private feedback" | "none"
    "attribution": string | null
    "publishable": boolean   // derived: permission is approved AND text present
  }

  "review": {                        // Kevin 8/31: completion hands off to a review ask
    "asked":   boolean               // false when the survey has the toggle off
    "outcome": "clicked" | "dismissed" | "not_asked"
  }

  "hubspot": {
    "status":     "written" | "skipped" | "failed" | "not_applicable"
    "written_at": ISO8601 | null
    "error":      string | null
  }

  "meta": {
    "ip_hash":     string    // sha256(ip + salt). the raw IP is never stored
    "country":     string | null   // ISO 3166-1 alpha-2, resolved from the IP at receipt, best effort
    "user_agent":  string | null
    "received_at": ISO8601   // server clock. this is Kevin's "date and time of submission"
  }
}
```

## Rules that travel with the contract

These are not suggestions. Each one exists because the chat already behaves this way.

**1. A quote marked `private feedback` is never published, never displayed as a testimonial, and never appears in any export labelled for the website.** The engine assigns this value automatically when its sentiment gate reads an answer as unhappy (`js/engine.js`, the `isNegative` branch), and it skips the permission question entirely. The respondent was told on screen: *"Thank you for the honesty. That stays private feedback, it will not be published anywhere."* Publishing it would break a promise the product made in writing.

**2. `publishable: true` is a candidate, not a decision.** Every approved quote passes a human approval step in the dashboard before anyone can use it. This is also the highest-value security control in the whole system: it is what stops a leaked survey link from putting fabricated words on a client's website.

**3. `attribution` is populated only on the approved path, and is often `null`.** Never synthesize it from the contact record. The respondent chose what to be called.

**4. Published stats are computed over `counted == true` only.** Anonymous responses are directional colour, not evidence. A number anyone can move with a script is not publishable, and shipping one would expose the client.

**5. `answers` is an ordered array, not a map.** The dashboard renders questions in survey order, and `question_id` is only unique within a survey.

**6. NPS arrives as a string and is normalized at the boundary.** The engine records the tapped option's label, so an NPS 9 is the string `"9"`, while the prototype's seed data uses the integer `9`. The prototype dashboard only survives this by defending with `parseInt`. The backend populates BOTH `value_text` and `value_number` for any `nps: true` question. Average on `value_number` and never parse text.

**7. Join key.** `response_id` is written back to the HubSpot contact as `sr_response_id`, so a dashboard row can link to the contact and back.

**8. Uniqueness is `(survey_id, client_response_id)`.** The chat has a Restart button, so one person can complete twice. Duplicates collapse at the backend, not in your dashboard.

## Changed 2026-09-01, from Kevin's 8/31 review

Three additions: `respondent` (name and email, captured only when the survey's
`require_contact` setting is on), `review` (his new ending asks for a review on
completion, and the outcome is recorded), and `meta.country` (resolved
server-side from the request IP, best effort, null when resolution fails).

**Privacy position on the IP, decided rather than defaulted:** Kevin asked to
capture the IP address. A respondent's IP is personal data and these are a
client's customers, so the raw IP is never stored and never shown. What is
stored is a salted hash (duplicate detection still works) plus the derived
country. If a raw IP ever needs to be visible, that is a product decision
needing a retention window and a line in the client's privacy policy first.

## Yours to decide, and not blocking

- The datastore itself. Supabase, Postgres, whatever you prefer. The contract is storage-agnostic on purpose.
- Retention.
- Push or pull. Either the backend calls an ingest endpoint you expose, or you read `GET /admin/export?since=<iso>` and backfill. Say which and Ralph builds that side.

## What the backend holds until your database exists

Append-only JSONL on a Fly volume, plus one structured line per response to stdout. `GET /admin/export` returns it so you can backfill in one command. When your database lands, the backend adds a forwarding call and the JSONL stays as an audit log.
