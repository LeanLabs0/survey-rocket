import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

type Stat = {
  answers: number;
  average: number | null;
  choices: Record<string, number> | null;
};
type Payload = { responses?: number; questions?: Record<string, Stat> };
type Question = { id: string; type: string; nps?: boolean; q?: string; options?: string[] };
type Crowd = {
  withMine: (payload: Payload | null, questions: Question[], answers: Record<string, unknown> | null) => Payload;
  meta: (payload: Payload | null) => string;
};

function loadCrowd(): Crowd {
  const code = fs.readFileSync(new URL("../../public/js/crowd.js", import.meta.url), "utf8");
  const window = {} as { SRCrowd?: Crowd };
  vm.runInNewContext(code, { window, document: {}, console });
  if (!window.SRCrowd) throw new Error("crowd.js did not publish SRCrowd");
  return window.SRCrowd;
}

const crowd = loadCrowd();

test("a person's own choice is counted when the totals were fetched without them", () => {
  const payload: Payload = {
    responses: 2,
    questions: {
      built: { answers: 2, average: null, choices: { "HubSpot CMS": 2 } },
    },
  };
  const snapshot = structuredClone(payload);
  const answers = { built: "Webflow" };
  const out = crowd.withMine(
    payload,
    [{ id: "built", type: "choice", options: ["HubSpot CMS", "Webflow"] }],
    answers,
  );
  assert.equal(out.responses, 3);
  assert.equal(out.questions?.built.answers, 3);
  assert.equal(out.questions?.built.choices?.Webflow, 1);
  assert.equal(out.questions?.built.choices?.["HubSpot CMS"], 2);
  assert.equal(crowd.meta(out), "3 completed responses");
  assert.deepEqual(payload, snapshot);
  assert.deepEqual(answers, { built: "Webflow" });
});

test("the first person to finish is one response, not zero", () => {
  const out = crowd.withMine(
    { responses: 0, questions: {} },
    [{ id: "built", type: "choice", options: ["Webflow"] }],
    { built: "Webflow" },
  );
  assert.equal(out.responses, 1);
  assert.equal(out.questions?.built.answers, 1);
  assert.equal(out.questions?.built.choices?.Webflow, 1);
  assert.equal(out.questions?.built.average, null);
  assert.equal(crowd.meta(out), "1 completed response");
});

test("multi-select counts the person once and each pick once", () => {
  const out = crowd.withMine(
    {
      responses: 2,
      questions: {
        channels: { answers: 2, average: null, choices: { SEO: 2, Paid: 1 } },
      },
    },
    [{ id: "channels", type: "multi", options: ["SEO", "Paid"] }],
    { channels: ["Paid", "SEO"] },
  );
  assert.equal(out.questions?.channels.answers, 3);
  assert.equal(out.questions?.channels.choices?.SEO, 3);
  assert.equal(out.questions?.channels.choices?.Paid, 2);
  assert.equal(out.questions?.channels.average, null);
});

test("a number average keeps the exact earlier mean and the whole number that is saved", () => {
  const out = crowd.withMine(
    {
      responses: 6,
      questions: {
        leads: { answers: 6, average: 7 / 6, choices: null },
      },
    },
    [{ id: "leads", type: "number" }],
    { leads: 10.6 },
  );
  assert.equal(out.questions?.leads.average, (7 + 11) / 7);
  assert.equal(out.questions?.leads.answers, 7);
  assert.equal(out.questions?.leads.choices, null);
});

test("a typed number that was not stored as a number does not move the average", () => {
  const out = crowd.withMine(
    {
      responses: 1,
      questions: { leads: { answers: 1, average: 4, choices: null } },
    },
    [{ id: "leads", type: "number" }],
    { leads: "10" },
  );
  assert.equal(out.questions?.leads.answers, 2);
  assert.equal(out.questions?.leads.average, 4);
  assert.equal(out.questions?.leads.choices, null);
});

test("zero is a real number, and an average of zero can be blended", () => {
  const out = crowd.withMine(
    {
      responses: 2,
      questions: { leads: { answers: 2, average: 0, choices: null } },
    },
    [{ id: "leads", type: "number" }],
    { leads: 0 },
  );
  assert.equal(out.questions?.leads.average, 0);
  assert.equal(out.questions?.leads.answers, 3);
});

test("a missing average is not replaced with this person's number", () => {
  const out = crowd.withMine(
    {
      responses: 4,
      questions: { nps: { answers: 4, average: null, choices: { "8": 4 } } },
    },
    [{ id: "nps", type: "choice", nps: true, options: ["0", "8", "10"] }],
    { nps: "10" },
  );
  assert.equal(out.questions?.nps.average, null);
  assert.equal(out.questions?.nps.answers, 5);
  assert.equal(out.questions?.nps.choices?.["10"], 1);
  assert.equal(out.questions?.nps.choices?.["8"], 4);
});

test("an NPS score updates the average and that score's bar", () => {
  const out = crowd.withMine(
    {
      responses: 2,
      questions: { nps: { answers: 2, average: 8, choices: { "8": 2 } } },
    },
    [{ id: "nps", type: "choice", nps: true, options: ["8", "10"] }],
    { nps: "10" },
  );
  assert.equal(out.questions?.nps.average, (8 * 2 + 10) / 3);
  assert.equal(out.questions?.nps.choices?.["10"], 1);
  assert.equal(out.questions?.nps.choices?.["0"], undefined);
});

test("a recommendation score stored as a number still gets a bar", () => {
  const out = crowd.withMine(
    { responses: 0, questions: {} },
    [{ id: "nps", type: "number", nps: true }],
    { nps: 9.6 },
  );
  assert.equal(out.questions?.nps.average, 10);
  assert.equal(out.questions?.nps.choices?.["10"], 1);
});

test("text is not charted, a skip is not an answer, and the completion still counts", () => {
  const out = crowd.withMine(
    { responses: 0, questions: {} },
    [
      { id: "why", type: "text" },
      { id: "built", type: "choice" },
      { id: "channels", type: "multi" },
    ],
    { why: "hello", built: null, channels: [] },
  );
  assert.equal(out.responses, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(out.questions)), {});
  assert.equal(crowd.meta({ responses: 0 }), "No completed responses yet.");
});

test("no answer sheet leaves the totals untouched", () => {
  const payload: Payload = { responses: 2, questions: {} };
  const out = crowd.withMine(payload, [{ id: "built", type: "choice" }], null);
  assert.equal(out.responses, 2);
  assert.notEqual(out, payload);
});

test("an NPS score of zero is kept", () => {
  const out = crowd.withMine(
    { responses: 0, questions: {} },
    [{ id: "nps", type: "choice", nps: true, options: ["0", "10"] }],
    { nps: "0" },
  );
  assert.equal(out.questions?.nps.average, 0);
  assert.equal(out.questions?.nps.choices?.["0"], 1);
});

test("a hostile choice label cannot break the other counts", () => {
  const out = crowd.withMine(
    { responses: 1, questions: {} },
    [
      { id: "bad", type: "choice" },
      { id: "ok", type: "choice" },
    ],
    { bad: "__proto__", ok: "Webflow" },
  );
  assert.equal(out.responses, 2);
  assert.equal(out.questions?.ok.choices?.Webflow, 1);
  assert.equal(out.questions?.bad.answers, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(out.questions?.bad.choices, "__proto__"), false);
  assert.equal(Object.getOwnPropertyDescriptor(Object.prototype, "Webflow"), undefined);
});
