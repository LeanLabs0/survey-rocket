import assert from "node:assert/strict";
import test from "node:test";
import { hubspotListsApproved } from "./definition.ts";

test("HubSpot lists are off unless the survey has them switched on", () => {
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: true } }), true);
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: false } }), false);
  assert.equal(hubspotListsApproved({ settings: { hubspot_lists: "true" } }), false);
  assert.equal(hubspotListsApproved({ settings: {} }), false);
  assert.equal(hubspotListsApproved({}), false);
  assert.equal(hubspotListsApproved(null), false);
});

test("the old per-answer list setting does not turn lists on", () => {
  assert.equal(hubspotListsApproved({ settings: { hubspot_answer_lists: true } }), false);
});
