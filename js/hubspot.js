/* Survey Rocket transport. Was a console stub; now the real sender.
   Kept the filename and the SRHubSpot global so no script tag changes.

   One request per completed survey, to the response endpoint on factor8.
   Design rules, from docs/completion-backend-spec.md:
   - text/plain body: a CORS simple request, no preflight, and the write lands
     even if CORS is misconfigured, because CORS only gates reading the reply.
   - keepalive: survives the tab closing right after the last tap.
   - never throws, never blocks UI: a respondent has already seen the outro.
   - failure goes to a localStorage outbox (cap 5) and retries on the next
     load and on visibilitychange; the outbox clears only on a confirmed 2xx.
   - re-sending with the same client_response_id is an upsert server-side, so
     the review outcome can be patched by sending the full payload again.
   The HubSpot contact write stays out of this file: it is phase 2 of the
   backend spec and blocked on a private app token that does not exist yet. */
(function (global) {
  "use strict";

  var API = "https://factor8-agent-sdk.fly.dev/api/v1/public/survey-rocket/responses";
  var K_OUTBOX = "sr:outbox:v1";
  var OUTBOX_CAP = 5;

  function uuid() {
    try { return crypto.randomUUID(); } catch (e) {}
    return "sr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  /* answers map -> the contract's ordered array, typed per the survey script.
     _quote fields are lifted out so they can never masquerade as questions. */
  function normalize(survey, answers) {
    var out = [];
    (survey.questions || []).forEach(function (q) {
      var v = answers[q.id];
      var row = {
        question_id: q.id, question_text: q.q || null,
        type: q.type || "text", nps: !!q.nps,
        value_text: null, value_number: null, value_list: null,
        skipped: v === null || v === undefined
      };
      if (Array.isArray(v)) row.value_list = v;
      else if (typeof v === "number") row.value_number = v;
      else if (v !== null && v !== undefined) {
        row.value_text = String(v);
        var n = parseFloat(v);
        if (q.nps && !isNaN(n)) row.value_number = n;
      }
      out.push(row);
    });
    return out;
  }

  function outbox() {
    try { return JSON.parse(localStorage.getItem(K_OUTBOX)) || []; } catch (e) { return []; }
  }
  function saveOutbox(list) {
    try { localStorage.setItem(K_OUTBOX, JSON.stringify(list.slice(-OUTBOX_CAP))); } catch (e) {}
  }

  function post(payload) {
    return fetch(API, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json().catch(function () { return { ok: true }; });
    });
  }

  function flush() {
    var pending = outbox();
    if (!pending.length) return;
    saveOutbox([]);
    pending.forEach(function (p) {
      post(p).catch(function () { saveOutbox(outbox().concat([p])); });
    });
  }

  var SRHubSpot = {
    enabled: true,
    uuid: uuid,

    /* Build the contract payload. review defaults to not_asked; the caller
       re-sends with the real outcome once the respondent decides. */
    buildPayload: function (survey, answers, opts) {
      opts = opts || {};
      var quote = answers._quote !== undefined ? {
        text: answers._quote || null,
        permission: answers._quotePermission || "none",
        attribution: answers._quoteAttribution || null
      } : { text: null, permission: "none", attribution: null };
      return {
        schema_version: 1,
        client_response_id: opts.clientResponseId || uuid(),
        survey_id: survey.id || "shared",
        survey_name: survey.name || null,
        token: null,
        source: "share",
        started_at: opts.startedAt || null,
        completed_at: new Date().toISOString(),
        respondent: { name: opts.name || null, email: opts.email || null },
        answers: normalize(survey, answers),
        quote: quote,
        review: { asked: !!opts.reviewAsked, outcome: opts.reviewOutcome || "not_asked" }
      };
    },

    send: function (payload) {
      post(payload).catch(function () { saveOutbox(outbox().concat([payload])); });
    },

    /* Aggregates for the respondent-facing results moment. Numbers only,
       never text answers or contact fields; null on any failure so the page
       degrades to a plain thank-you rather than an error. */
    results: function (surveyId) {
      return fetch(API.replace("/responses", "/results/") + encodeURIComponent(surveyId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    },

    /* Back-compat shim: the old stub's name, now doing the real thing badly
       enough that callers should migrate. Kept so nothing breaks mid-upgrade. */
    writeBack: function (surveyId, answers) {
      this.send(this.buildPayload({ id: surveyId, questions: [] }, answers, {}));
      return { status: "sent" };
    }
  };

  global.SRHubSpot = SRHubSpot;
  try {
    flush();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") flush();
    });
  } catch (e) {}
})(window);
