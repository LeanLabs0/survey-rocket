/* HubSpot write-back, STUB for the Lean Labs test phase.
   The real version calls a server-side endpoint holding a private app token
   (contact properties + timeline note + completed flag that meets the workflow goal).
   Wire-up point: replace writeBack() body with a fetch to that endpoint. */
(function (global) {
  "use strict";
  global.SRHubSpot = {
    enabled: false,
    writeBack: function (surveyId, answers) {
      console.info("[SurveyRocket] HubSpot write-back pending (stub).", { surveyId: surveyId, answers: answers });
      return { status: "pending", note: "HubSpot write-back is stubbed in this prototype. Wired when the private app token lands." };
    }
  };
})(window);
