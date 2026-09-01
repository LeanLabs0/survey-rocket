/* Survey Rocket survey store: the editor's working copies, in localStorage.
   Responses never live here; they post to the shared store on completion and
   Results reads them back from it. Save in the editor also publishes the
   definition so the survey's one link serves the latest version. */
(function (global) {
  "use strict";

  var K_SURVEYS = "sr:surveys:v1";

  function seedSurveys() {
    return [
      {
        schema_version: 1,
        id: "client-outcomes",
        name: "Client outcomes",
        cadence: "90 day",
        status: "Active",
        /* Kevin 8/31: no optional last question. The old quoteAsk ending is
           gone; completion is results + review ask, driven by settings, and
           the optional text question sits mid-survey rather than closing it. */
        settings: { require_contact: false, show_results: true, review_ask: true, review_links: { google: "https://g.page/r/lean-labs/review" } },
        questions: [
          { id: "service", type: "choice", q: "Which Lean Labs program are you on?", options: ["AEO program", "Website Launchpad", "Growth retainer", "Other"] },
          { id: "leads", type: "number", q: "About how many qualified leads per month does your site produce now?", min: 0, max: 10000 },
          { id: "pipeline", type: "choice", q: "Compared with before working with us, how has qualified pipeline changed?", options: ["Down", "Flat", "Up to 25% up", "26 to 75% up", "More than 75% up"] },
          { id: "changed", type: "text", optional: true, q: "What changed most since we started? One sentence is plenty. Optional, type skip to move on." },
          { id: "nps", type: "choice", nps: true, q: "How likely are you to recommend Lean Labs to a peer?", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] }
        ],
        provenance: { source: "template", drafted_by: null, approved_by: "Ralph", approved_at: "2026-09-01" }
      },
      {
        schema_version: 1,
        id: "project-onboarding",
        name: "Project onboarding",
        cadence: "Day 30",
        status: "Active",
        settings: { require_contact: false, show_results: false, review_ask: false, review_links: {} },
        questions: [
          { id: "clarity", type: "choice", q: "How clear was the kickoff process?", options: ["Very unclear", "Unclear", "Neutral", "Clear", "Very clear"] },
          { id: "speed", type: "choice", q: "How was the pace of the first 30 days?", options: ["Too slow", "About right", "Too fast"] },
          { id: "wish", type: "text", optional: true, q: "Anything you wish you had known on day one? Optional, type skip to move on." }
        ],
        provenance: { source: "template", drafted_by: null, approved_by: "Ralph", approved_at: "2026-09-01" }
      }
    ];
  }

  /* v0 records (pre schema pin, or stale localStorage from an earlier visit)
     upgrade on read. Rule 4 in docs/question-schema.md. */
  function upgradeSurvey(sv) {
    if (!sv) return sv;
    if (sv.schema_version === 1) return sv;
    sv.schema_version = 1;
    sv.settings = sv.settings || {
      require_contact: false,
      /* old quoteAsk surveys ended on an optional quote; the nearest v1
         behaviour is the review ending switched on */
      show_results: !!sv.quoteAsk,
      review_ask: !!sv.quoteAsk,
      review_links: {}
    };
    delete sv.quoteAsk;
    sv.provenance = sv.provenance || { source: "hand", drafted_by: null, approved_by: null, approved_at: null };
    return sv;
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var Store = {
    init: function () {
      if (!read(K_SURVEYS, null)) write(K_SURVEYS, seedSurveys());
      /* the pre-merge response store; clear it so no stale copy lingers */
      try { localStorage.removeItem("sr:responses:v1"); } catch (e) {}
    },
    reset: function () {
      write(K_SURVEYS, seedSurveys());
    },
    surveys: function () { return read(K_SURVEYS, []).map(upgradeSurvey); },
    saveSurveys: function (list) { return write(K_SURVEYS, list); },
    getSurvey: function (id) {
      var found = null;
      this.surveys().forEach(function (s) { if (s.id === id) found = s; });
      return found;
    },
    upsertSurvey: function (survey) {
      var list = this.surveys(), hit = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === survey.id) { list[i] = survey; hit = true; }
      }
      if (!hit) list.push(survey);
      return this.saveSurveys(list);
    },
    removeSurvey: function (id) {
      return this.saveSurveys(this.surveys().filter(function (s) { return s.id !== id; }));
    },
    /* legacy share links: #p= fragments issued before the publish endpoint.
       They keep working forever; nothing mints new ones. */
    decodeShare: function (b64) {
      try { return upgradeSurvey(JSON.parse(decodeURIComponent(escape(atob(b64))))); }
      catch (e) { return null; }
    }
  };

  global.SRStore = Store;
})(window);
