import assert from "node:assert/strict";
import test from "node:test";
import { answerListName, answerListsEnabled, answerSegments, type AnswerRow } from "./answer-lists.ts";

function row(partial: Partial<AnswerRow> & { questionKey: string; type: string }): AnswerRow {
  return { valueText: null, valueNumber: null, valueList: null, skipped: false, ...partial };
}

test("choice and multi answers become one segment per picked option", () => {
  const segments = answerSegments([
    row({ questionKey: "built_with", type: "choice", valueText: "HubSpot CMS" }),
    row({ questionKey: "channels", type: "multi", valueList: ["SEO", "Paid", "SEO"] }),
    row({ questionKey: "nps", type: "choice", valueText: "9", valueNumber: 9 }),
  ]);
  assert.deepEqual(segments, [
    { questionKey: "built_with", value: "HubSpot CMS" },
    { questionKey: "channels", value: "SEO" },
    { questionKey: "channels", value: "Paid" },
    { questionKey: "nps", value: "9" },
  ]);
});

test("text, number, skipped and blank answers are not segments", () => {
  const segments = answerSegments([
    row({ questionKey: "why", type: "text", valueText: "Because" }),
    row({ questionKey: "team", type: "number", valueNumber: 12 }),
    row({ questionKey: "built_with", type: "choice", valueText: "Webflow", skipped: true }),
    row({ questionKey: "last_redesign", type: "choice", valueText: "  " }),
    row({ questionKey: "channels", type: "multi", valueList: null }),
  ]);
  assert.deepEqual(segments, []);
});

test("a choice stored only as a number still counts", () => {
  assert.deepEqual(answerSegments([row({ questionKey: "nps", type: "choice", valueNumber: 0 })]), [
    { questionKey: "nps", value: "0" },
  ]);
});

test("list names carry the survey, the question id and the answer", () => {
  assert.equal(
    answerListName("Is your website ready for 2027?", { questionKey: "built_with", value: "HubSpot CMS" }),
    "[LL] SurveyRocket - Is your website ready for 2027? - built_with = HubSpot CMS",
  );
  const long = answerListName("S", { questionKey: "q", value: "x".repeat(200) });
  assert.equal(long, `[LL] SurveyRocket - S - q = ${"x".repeat(80)}`);
});

test("answer lists are opt-in", () => {
  assert.equal(answerListsEnabled({ settings: { hubspot_answer_lists: true } }), true);
  assert.equal(answerListsEnabled({ settings: { hubspot_answer_lists: "true" } }), false);
  assert.equal(answerListsEnabled({ settings: {} }), false);
  assert.equal(answerListsEnabled(null), false);
});
