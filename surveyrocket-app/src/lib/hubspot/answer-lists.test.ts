import assert from "node:assert/strict";
import test from "node:test";
import { answerListName, answerListsEnabled, answerSegments, publishedSurveyName, type AnswerRow } from "./answer-lists.ts";

function row(partial: Partial<AnswerRow> & { questionKey: string; type: string }): AnswerRow {
  return { valueText: null, valueNumber: null, valueList: null, skipped: false, ...partial };
}

const published = {
  name: "Is your website ready for 2027?",
  questions: [
    { id: "built_with", type: "choice", options: ["HubSpot CMS", "Webflow"] },
    { id: "channels", type: "multi", options: ["SEO", "Paid"] },
    { id: "nps", type: "choice", options: ["0", "9", "10"] },
    { id: "why", type: "text" },
    { id: "team", type: "number" },
    { id: "last_redesign", type: "choice", options: ["This year"] },
  ],
};

test("choice and multi answers become one segment per picked option", () => {
  const segments = answerSegments(
    [
      row({ questionKey: "built_with", type: "choice", valueText: "HubSpot CMS" }),
      row({ questionKey: "channels", type: "multi", valueList: ["SEO", "Paid", "SEO"] }),
      row({ questionKey: "nps", type: "choice", valueText: "9", valueNumber: 9 }),
    ],
    published,
  );
  assert.deepEqual(segments, [
    { questionKey: "built_with", value: "HubSpot CMS" },
    { questionKey: "channels", value: "SEO" },
    { questionKey: "channels", value: "Paid" },
    { questionKey: "nps", value: "9" },
  ]);
});

test("text, number, skipped and blank answers are not segments", () => {
  const segments = answerSegments(
    [
      row({ questionKey: "why", type: "text", valueText: "Because" }),
      row({ questionKey: "team", type: "number", valueNumber: 12 }),
      row({ questionKey: "built_with", type: "choice", valueText: "Webflow", skipped: true }),
      row({ questionKey: "last_redesign", type: "choice", valueText: "  " }),
      row({ questionKey: "channels", type: "multi", valueList: null }),
    ],
    published,
  );
  assert.deepEqual(segments, []);
});

test("a choice stored only as a number still counts", () => {
  assert.deepEqual(answerSegments([row({ questionKey: "nps", type: "choice", valueNumber: 0 })], published), [
    { questionKey: "nps", value: "0" },
  ]);
});

test("answers that are not published options do not open a list", () => {
  const segments = answerSegments(
    [
      row({ questionKey: "built_with", type: "choice", valueText: "not a real option" }),
      row({ questionKey: "made_up", type: "choice", valueText: "HubSpot CMS" }),
      row({ questionKey: "why", type: "choice", valueText: "Because" }),
      row({ questionKey: "channels", type: "multi", valueList: ["SEO", "invented", "Paid"] }),
    ],
    published,
  );
  assert.deepEqual(segments, [
    { questionKey: "channels", value: "SEO" },
    { questionKey: "channels", value: "Paid" },
  ]);
});

test("no published questions means no lists, even if the row claims a choice", () => {
  assert.deepEqual(
    answerSegments([row({ questionKey: "built_with", type: "choice", valueText: "HubSpot CMS" })], null),
    [],
  );
  assert.deepEqual(
    answerSegments([row({ questionKey: "built_with", type: "choice", valueText: "HubSpot CMS" })], {}),
    [],
  );
});

test("list names carry the survey, the question id and the answer", () => {
  assert.equal(
    answerListName("Is your website ready for 2027?", { questionKey: "built_with", value: "HubSpot CMS" }),
    "[LL] SurveyRocket - Is your website ready for 2027? - built_with = HubSpot CMS",
  );
  const long = answerListName("S", { questionKey: "q", value: "x".repeat(200) });
  const other = answerListName("S", { questionKey: "q", value: `${"x".repeat(199)}y` });
  assert.notEqual(long, other);
  assert.equal(long.startsWith("[LL] SurveyRocket - S - q = "), true);
  assert.equal(long.length <= 255, true);
  assert.equal(other.length <= 255, true);
});

test("list names use the published survey title when it is set", () => {
  assert.equal(publishedSurveyName({ name: "  Live title  " }, "Draft title"), "Live title");
  assert.equal(publishedSurveyName({ name: "   " }, "Draft title"), "Draft title");
  assert.equal(publishedSurveyName(null, "Draft title"), "Draft title");
});

test("answer lists are opt-in", () => {
  assert.equal(answerListsEnabled({ settings: { hubspot_answer_lists: true } }), true);
  assert.equal(answerListsEnabled({ settings: { hubspot_answer_lists: "true" } }), false);
  assert.equal(answerListsEnabled({ settings: {} }), false);
  assert.equal(answerListsEnabled(null), false);
});
