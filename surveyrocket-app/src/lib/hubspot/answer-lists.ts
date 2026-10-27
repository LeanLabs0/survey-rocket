/**
 * One HubSpot static list per picked answer, so "built_with = HubSpot CMS" is a
 * list marketing can send to. Opt-in per survey via `settings.hubspot_answer_lists`.
 * Pure helpers here; the HubSpot calls live in lists.ts.
 */

const SURVEY_NAME_MAX = 72;
const ANSWER_VALUE_MAX = 80;
const QUESTION_KEY_MAX = 48;
/** HubSpot list names are unique in the whole portal. Stay under the usual 255 cap. */
const LIST_NAME_MAX = 255;

export type AnswerRow = {
  questionKey: string;
  type: string;
  valueText: string | null;
  valueNumber: number | null;
  valueList: string[] | null;
  skipped: boolean;
};

export type AnswerSegment = { questionKey: string; value: string };

type ChoiceQuestion = { type: "choice" | "multi"; options: Map<string, string> };

export function clipSurveyName(surveyName: string) {
  const trimmed = surveyName.trim() || "Untitled";
  return trimmed.length > SURVEY_NAME_MAX ? trimmed.slice(0, SURVEY_NAME_MAX).trim() : trimmed;
}

export function answerListsEnabled(definition: unknown) {
  if (!definition || typeof definition !== "object") return false;
  const settings = (definition as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object") return false;
  return (settings as { hubspot_answer_lists?: unknown }).hubspot_answer_lists === true;
}

/** The name on the publication the person answered, else the survey row. */
export function publishedSurveyName(definition: unknown, fallback: string) {
  if (definition && typeof definition === "object") {
    const name = (definition as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return fallback;
}

function tidy(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function fnv1a(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Keep a readable prefix. A short hash stops two long answers sharing one list. */
function clipPart(value: string, max: number) {
  const clean = tidy(value);
  if (clean.length <= max) return clean;
  const mark = fnv1a(clean);
  const room = max - mark.length - 1;
  if (room < 1) return mark.slice(0, max);
  return `${clean.slice(0, room).trim()}-${mark}`;
}

function choiceQuestions(definition: unknown) {
  const out = new Map<string, ChoiceQuestion>();
  if (!definition || typeof definition !== "object") return out;
  const questions = (definition as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return out;
  for (const raw of questions) {
    if (!raw || typeof raw !== "object") continue;
    const question = raw as { id?: unknown; type?: unknown; options?: unknown };
    const id = typeof question.id === "string" ? question.id.trim() : "";
    if (!id || (question.type !== "choice" && question.type !== "multi")) continue;
    const options = new Map<string, string>();
    if (Array.isArray(question.options)) {
      for (const option of question.options) {
        const text = tidy(String(option ?? ""));
        if (!text || options.has(text)) continue;
        options.set(text, text);
      }
    }
    out.set(id, { type: question.type, options });
  }
  return out;
}

/**
 * One segment per picked choice or multi option.
 * The question type and the allowed values come from the published survey, not from the
 * answer row. A public completion can send any text; only options written on the survey
 * become lists. Text, number, skipped, blank, and unknown answers are not segments.
 */
export function answerSegments(rows: AnswerRow[], definition: unknown): AnswerSegment[] {
  const questions = choiceQuestions(definition);
  const out: AnswerSegment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.skipped) continue;
    const spec = questions.get(String(row.questionKey || "").trim());
    if (!spec || spec.options.size === 0) continue;
    const picked =
      spec.type === "multi"
        ? Array.isArray(row.valueList) ? row.valueList : []
        : [row.valueText ?? (row.valueNumber != null ? String(row.valueNumber) : "")];
    const limit = Math.min(picked.length, Math.max(spec.options.size * 3, 1));
    for (let i = 0; i < limit; i++) {
      const value = spec.options.get(tidy(String(picked[i] ?? "")));
      if (!value) continue;
      const key = `${row.questionKey}\u0000${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ questionKey: String(row.questionKey).trim(), value });
    }
  }
  return out;
}

export function answerListName(surveyName: string, segment: AnswerSegment) {
  const questionKey = clipPart(segment.questionKey, QUESTION_KEY_MAX) || "question";
  const value = clipPart(segment.value, ANSWER_VALUE_MAX) || "answer";
  const prefix = `[LL] SurveyRocket - ${clipSurveyName(surveyName)} - ${questionKey} = `;
  const name = `${prefix}${value}`;
  if (name.length <= LIST_NAME_MAX) return name;
  const mark = fnv1a(`${segment.questionKey}\u0000${segment.value}`);
  const room = LIST_NAME_MAX - mark.length - 1;
  return `${name.slice(0, Math.max(0, room)).trim()}-${mark}`.slice(0, LIST_NAME_MAX);
}
