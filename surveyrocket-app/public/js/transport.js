/* Survey Rocket transport. CORS-simple text/plain POST with keepalive + outbox. */
(function (global) {
  "use strict";

  var API = "/api/public/responses";
  var K_OUTBOX = "sr:outbox:v1";
  var OUTBOX_CAP = 5;

  function uuid() {
    try { return crypto.randomUUID(); } catch (e) {}
    return "sr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

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
        survey_id: survey.public_id || survey.id || "shared",
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
    fetchSurvey: function (surveyId) {
      return fetch("/api/public/surveys/" + encodeURIComponent(surveyId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return null;
          if (d.definition && d.definition.questions) return Object.assign({ public_id: d.public_id }, d.definition, {
            client_name: d.client_name, logo_url: d.logo_url
          });
          if (d.questions) return d;
          return null;
        })
        .catch(function () { return null; });
    },
    results: function (surveyId) {
      return fetch("/api/public/results/" + encodeURIComponent(surveyId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
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
