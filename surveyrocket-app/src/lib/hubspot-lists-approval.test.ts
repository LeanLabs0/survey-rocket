import assert from "node:assert/strict";
import test from "node:test";
import {
  blankDefinition,
  hubspotEnrollmentStage,
  hubspotListsApproved,
  publishedHubspotListsApproved,
  stripHubspotListApproval,
  stripHubspotListSettings,
} from "./definition.ts";

test("HubSpot lists are off unless the survey has them switched on", () => {
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: true } }), true);
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: false } }), false);
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: "true" } }), false);
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: 1 } }), false);
  assert.equal(hubspotListsApproved({ settings: {} }), false);
  assert.equal(hubspotListsApproved({ settings: [] }), false);
  assert.equal(hubspotListsApproved({}), false);
  assert.equal(hubspotListsApproved([]), false);
  assert.equal(hubspotListsApproved(null), false);
});

test("the old per-answer list setting does not turn lists on", () => {
  assert.equal(hubspotListsApproved({ settings: { hubspot_answer_lists: true } }), false);
  assert.equal(
    hubspotListsApproved({ settings: { hubspot_answer_lists: true, hubspot_lists: false } }),
    false,
  );
});

test("only a publication can approve HubSpot lists", () => {
  const approved = { definition: { settings: { hubspot_lists: true } } };
  assert.equal(publishedHubspotListsApproved(approved), true);
  assert.equal(publishedHubspotListsApproved({ definition: { settings: { hubspot_lists: true } } }), true);
  assert.equal(publishedHubspotListsApproved({ definition: null }), false);
  assert.equal(publishedHubspotListsApproved({ definition: { settings: { hubspot_answer_lists: true } } }), false);
  assert.equal(publishedHubspotListsApproved(null), false);
  assert.equal(publishedHubspotListsApproved(undefined), false);
});

test("a copied or new survey does not inherit HubSpot list approval", () => {
  const copy = stripHubspotListApproval({
    name: "Growth (copy)",
    settings: { show_results: true, hubspot_lists: true, hubspot_answer_lists: true },
  });
  assert.equal(copy.settings.hubspot_lists, undefined);
  assert.equal(copy.settings.hubspot_answer_lists, undefined);
  assert.equal(copy.settings.show_results, true);
  assert.equal(copy.name, "Growth (copy)");
  assert.equal(hubspotListsApproved(copy), false);

  const settings = stripHubspotListSettings({ hubspot_lists: true, review_ask: true });
  assert.equal(settings.hubspot_lists, undefined);
  assert.equal(settings.review_ask, true);

  const created = blankDefinition({
    id: "new",
    name: "New",
    settings: {
      require_contact: false,
      show_results: true,
      review_ask: false,
      review_links: {},
      hubspot_lists: true,
    },
  });
  assert.equal(created.settings.show_results, true);
  assert.equal(Object.prototype.hasOwnProperty.call(created.settings, "hubspot_lists"), false);
  assert.equal(hubspotListsApproved(created), false);
});

test("a failed sign-in retry does not join the completed list", () => {
  assert.equal(hubspotEnrollmentStage(null), "signedIn");
  assert.equal(hubspotEnrollmentStage(undefined), "signedIn");
  assert.equal(hubspotEnrollmentStage(new Date(Number.NaN)), "signedIn");
  assert.equal(hubspotEnrollmentStage(new Date("2026-10-28T12:00:00Z")), "completed");
});
