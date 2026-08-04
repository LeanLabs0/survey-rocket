/* Survey Rocket prototype store. localStorage only, by design for the Lean Labs test phase.
   Limitation stated in the README: surveys and responses live in THIS browser.
   Phase 2 swaps these functions for a real data store without touching the pages. */
(function (global) {
  "use strict";

  var K_SURVEYS = "sr:surveys:v1";
  var K_RESPONSES = "sr:responses:v1";

  function seedSurveys() {
    return [
      {
        id: "client-outcomes",
        name: "Client outcomes",
        cadence: "90 day",
        status: "Active",
        quoteAsk: true,
        questions: [
          { id: "service", type: "choice", q: "Which Lean Labs program are you on?", options: ["AEO program", "Website Launchpad", "Growth retainer", "Other"] },
          { id: "leads", type: "number", q: "About how many qualified leads per month does your site produce now?", min: 0, max: 10000 },
          { id: "pipeline", type: "choice", q: "Compared with before working with us, how has qualified pipeline changed?", options: ["Down", "Flat", "Up to 25% up", "26 to 75% up", "More than 75% up"] },
          { id: "nps", type: "choice", nps: true, q: "How likely are you to recommend Lean Labs to a peer?", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
          { id: "changed", type: "text", optional: true, q: "What changed most since we started? One sentence is plenty. Optional, type skip to move on." }
        ]
      },
      {
        id: "project-onboarding",
        name: "Project onboarding",
        cadence: "Day 30",
        status: "Active",
        quoteAsk: false,
        questions: [
          { id: "clarity", type: "choice", q: "How clear was the kickoff process?", options: ["Very unclear", "Unclear", "Neutral", "Clear", "Very clear"] },
          { id: "speed", type: "choice", q: "How was the pace of the first 30 days?", options: ["Too slow", "About right", "Too fast"] },
          { id: "wish", type: "text", optional: true, q: "Anything you wish you had known on day one? Optional, type skip to move on." }
        ]
      }
    ];
  }

  /* Seeded sample responses so the dashboard is not empty on first visit.
     Marked seeded:true and labeled in the UI. */
  function seedResponses() {
    var out = [];
    var bands = ["Down", "Flat", "Up to 25% up", "26 to 75% up", "More than 75% up"];
    var bandCounts = [1, 3, 6, 8, 5]; /* 23 responses */
    var services = ["AEO program", "Website Launchpad", "Growth retainer"];
    var npsSpread = [9, 10, 9, 8, 9, 10, 7, 9, 10, 8, 9, 6, 10, 9, 8, 9, 10, 9, 7, 9, 10, 5, 9];
    var i, b, n = 0;
    for (b = 0; b < bands.length; b++) {
      for (i = 0; i < bandCounts[b]; i++) {
        out.push({
          surveyId: "client-outcomes",
          seeded: true,
          at: "2026-07-" + (10 + (n % 18)),
          answers: {
            service: services[n % services.length],
            leads: 8 + (n * 7) % 90,
            pipeline: bands[b],
            nps: npsSpread[n % npsSpread.length]
          }
        });
        n++;
      }
    }
    var clar = ["Clear", "Very clear", "Clear", "Neutral", "Very clear", "Clear", "Very clear", "Clear"];
    for (i = 0; i < 8; i++) {
      out.push({
        surveyId: "project-onboarding",
        seeded: true,
        at: "2026-07-" + (12 + i),
        answers: { clarity: clar[i], speed: i % 5 === 3 ? "Too slow" : "About right", wish: null }
      });
    }
    return out;
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
      if (!read(K_RESPONSES, null)) write(K_RESPONSES, seedResponses());
    },
    reset: function () {
      write(K_SURVEYS, seedSurveys());
      write(K_RESPONSES, seedResponses());
    },
    surveys: function () { return read(K_SURVEYS, []); },
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
    responses: function (surveyId) {
      var all = read(K_RESPONSES, []);
      return surveyId ? all.filter(function (r) { return r.surveyId === surveyId; }) : all;
    },
    addResponse: function (surveyId, answers) {
      var all = read(K_RESPONSES, []);
      all.push({ surveyId: surveyId, seeded: false, at: new Date().toISOString().slice(0, 10), answers: answers });
      return write(K_RESPONSES, all);
    },
    /* portable respondent link: survey definition packed into the URL fragment */
    encodeShare: function (survey) {
      var json = JSON.stringify({ name: survey.name, cadence: survey.cadence, quoteAsk: survey.quoteAsk, questions: survey.questions, id: survey.id });
      return btoa(unescape(encodeURIComponent(json)));
    },
    decodeShare: function (b64) {
      try { return JSON.parse(decodeURIComponent(escape(atob(b64)))); }
      catch (e) { return null; }
    }
  };

  global.SRStore = Store;
})(window);
