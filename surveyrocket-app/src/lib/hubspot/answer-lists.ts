/**
 * One HubSpot static list per picked answer, so "built_with = HubSpot CMS" is a
 * list marketing can send to. Opt-in per survey via `settings.hubspot_answer_lists`.
 * Pure helpers here; the HubSpot calls live in lists.ts.
 */

const SURVEY_NAME_MAX = 72;
const ANSWER_VALUE_MAX = 80;

export type AnswerRow = {
  questionKey: string;
  type: string;
  valueText: string | null;
  valueNumber: number | null;
  valueList: string[] | null;
  skipped: boolean;
};

export type AnswerSegment = { questionKey: string; value: string };

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

/** Choice and multi answers only, one segment per picked option. Text and number answers are not segments. */
export function answerSegments(rows: AnswerRow[]): AnswerSegment[] {
  const out: AnswerSegment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.skipped) continue;
    if (row.type !== "choice" && row.type !== "multi") continue;
    const picked =
      row.type === "multi"
        ? Array.isArray(row.valueList) ? row.valueList : []
        : [row.valueText ?? (row.valueNumber != null ? String(row.valueNumber) : "")];
    for (const raw of picked) {
      const value = String(raw ?? "").trim();
      if (!value) continue;
      const key = `${row.questionKey}\u0000${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ questionKey: row.questionKey, value });
    }
  }
  return out;
}

export function answerListName(surveyName: string, segment: AnswerSegment) {
  const value = segment.value.length > ANSWER_VALUE_MAX ? segment.value.slice(0, ANSWER_VALUE_MAX).trim() : segment.value;
  return `[LL] SurveyRocket - ${clipSurveyName(surveyName)} - ${segment.questionKey} = ${value}`;
}
