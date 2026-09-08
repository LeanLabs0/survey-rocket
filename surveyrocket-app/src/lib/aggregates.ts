import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { answers, responses, surveys } from "./schema";

export type QuestionAgg = {
  question: string;
  type: string;
  nps: boolean;
  answers: number;
  average: number | null;
  choices: Record<string, number> | null;
  texts: string[];
};

export type SurveyAgg = {
  responses: number;
  this_week: number;
  latest_at: string | null;
  review_asked: number;
  review_clicked: number;
  questions: Record<string, QuestionAgg>;
};

export function statsFromAgg(
  name: string,
  agg: SurveyAgg,
  localQuestions?: { id: string; q?: string }[],
) {
  const qs = agg.questions || {};
  const order = localQuestions?.map((q) => q.id) ?? Object.keys(qs);
  let ready = 0;
  let total = 0;
  const pubs: { big: string; sub: string; sentence: string; answers: number }[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  for (const qid of order) {
    const q = qs[qid];
    total++;
    if (!q) continue;
    const qtext = localQuestions?.find((x) => x.id === qid)?.q || q.question || qid;
    const n = q.answers || 0;
    if (q.nps && q.choices) {
      let prom = 0,
        det = 0,
        tot = 0;
      for (const [k, c] of Object.entries(q.choices)) {
        const v = parseInt(k, 10);
        if (Number.isNaN(v)) continue;
        tot += c;
        if (v >= 9) prom += c;
        else if (v < 7) det += c;
      }
      if (tot >= 3) {
        ready++;
        const nps = Math.round(((prom - det) / tot) * 100);
        pubs.push({
          big: `NPS ${nps}`,
          sub: `Net Promoter Score, ${plural(tot, "answer")}`,
          sentence: `Net Promoter Score of ${nps} (${name}, ${plural(tot, "answer")})`,
          answers: tot,
        });
      }
    } else if (q.type === "number") {
      if (n >= 3 && q.average !== null && q.average !== undefined) {
        ready++;
        const avg = Math.round(q.average);
        pubs.push({
          big: avg.toLocaleString("en-US"),
          sub: `Average, ${qtext}`,
          sentence: `Average of ${avg.toLocaleString("en-US")} for “${qtext}” (${name}, ${plural(n, "answer")})`,
          answers: n,
        });
      }
    } else if (q.type === "choice" && q.choices) {
      let top: string | null = null;
      let sum = 0;
      for (const [k, c] of Object.entries(q.choices)) {
        sum += c;
        if (top === null || c > q.choices[top]) top = k;
      }
      if (sum >= 3 && top !== null) {
        ready++;
        const pct = Math.round((q.choices[top] / sum) * 100);
        pubs.push({
          big: `${pct}%`,
          sub: `picked “${top}”, ${qtext}`,
          sentence: `${pct}% picked “${top}” when asked “${qtext}” (${name}, ${plural(sum, "answer")})`,
          answers: sum,
        });
      }
    } else if (n >= 3) {
      ready++;
    }
  }
  pubs.sort((a, b) => b.answers - a.answers);
  return { ready, total, pubs: pubs.slice(0, 4) };
}

export async function aggregateSurvey(surveyId: string): Promise<SurveyAgg> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [totals] = await db
    .select({
      responses: count(),
      thisWeek: sql<number>`count(*) filter (where ${responses.completedAt} >= ${weekAgo}::timestamptz)`,
      latestAt: sql<Date | null>`max(${responses.completedAt})`,
      reviewAsked: sql<number>`count(*) filter (where ${responses.reviewAsked} = true)`,
      reviewClicked: sql<number>`count(*) filter (where ${responses.reviewOutcome} = 'clicked')`,
    })
    .from(responses)
    .where(eq(responses.surveyId, surveyId));

  const rows = await db.select().from(answers).where(eq(answers.surveyId, surveyId));
  const questions: Record<string, QuestionAgg> = {};
  for (const row of rows) {
    const key = row.questionKey;
    if (!questions[key]) {
      questions[key] = {
        question: row.questionText || key,
        type: row.type,
        nps: row.nps,
        answers: 0,
        average: null,
        choices: null,
        texts: [],
      };
    }
    const q = questions[key];
    if (row.skipped) continue;
    q.answers++;
    if (row.type === "number" || row.nps) {
      if (row.valueNumber !== null && row.valueNumber !== undefined) {
        const prev = q.average === null ? 0 : q.average * (q.answers - 1);
        q.average = (prev + row.valueNumber) / q.answers;
      }
    }
    if (row.type === "choice" || row.nps) {
      q.choices = q.choices || {};
      const label = row.valueText ?? (row.valueNumber !== null ? String(row.valueNumber) : null);
      if (label) q.choices[label] = (q.choices[label] || 0) + 1;
    }
    if (row.type === "multi" && Array.isArray(row.valueList)) {
      q.choices = q.choices || {};
      for (const item of row.valueList) {
        q.choices[item] = (q.choices[item] || 0) + 1;
      }
    }
    if (row.type === "text" && row.valueText) {
      q.texts.push(row.valueText);
    }
  }

  return {
    responses: Number(totals?.responses || 0),
    this_week: Number(totals?.thisWeek || 0),
    latest_at: totals?.latestAt ? new Date(totals.latestAt).toISOString() : null,
    review_asked: Number(totals?.reviewAsked || 0),
    review_clicked: Number(totals?.reviewClicked || 0),
    questions,
  };
}

export async function clientDashboardStats(clientId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const list = await db.select().from(surveys).where(eq(surveys.clientId, clientId));
  const [totals] = await db
    .select({
      answers: count(),
      thisWeek: sql<number>`count(*) filter (where ${responses.completedAt} >= ${weekAgo}::timestamptz)`,
      reviewClicked: sql<number>`count(*) filter (where ${responses.reviewOutcome} = 'clicked')`,
      reviewAsked: sql<number>`count(*) filter (where ${responses.reviewAsked} = true)`,
    })
    .from(responses)
    .where(eq(responses.clientId, clientId));

  const items = [];
  for (const sv of list) {
    const agg = await aggregateSurvey(sv.id);
    const def = sv.definition as { questions?: { id: string; q?: string }[] };
    const stats = statsFromAgg(sv.name, agg, def?.questions);
    items.push({ survey: sv, agg, stats });
  }
  const pubs = items
    .flatMap((it) => it.stats.pubs.map((pb) => ({ ...pb, surveyName: it.survey.name, surveyId: it.survey.id })))
    .sort((a, b) => b.answers - a.answers)
    .slice(0, 4);

  return {
    total: Number(totals?.answers || 0),
    week: Number(totals?.thisWeek || 0),
    clicked: Number(totals?.reviewClicked || 0),
    asked: Number(totals?.reviewAsked || 0),
    surveys: items,
    verified: pubs,
  };
}

export async function latestRespondents(surveyId: string, limit = 5) {
  return db
    .select()
    .from(responses)
    .where(eq(responses.surveyId, surveyId))
    .orderBy(desc(responses.completedAt))
    .limit(limit);
}

function clampDays(days: number, fallback: number) {
  if (!Number.isFinite(days) || days < 1) return fallback;
  return Math.min(90, Math.round(days));
}

function utcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeStart(days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

export async function answersBySurvey(clientId: string, days = 30) {
  const period = clampDays(days, 30);
  const since = rangeStart(period);
  const list = await db.select().from(surveys).where(eq(surveys.clientId, clientId));
  const rows = await db
    .select({
      surveyId: responses.surveyId,
      total: count(),
    })
    .from(responses)
    .where(and(eq(responses.clientId, clientId), gte(responses.completedAt, since)))
    .groupBy(responses.surveyId);
  const byId = new Map(rows.map((row) => [row.surveyId, Number(row.total)]));
  return {
    days: period,
    items: list.map((sv) => ({
      surveyId: sv.id,
      name: sv.name,
      count: byId.get(sv.id) || 0,
    })),
  };
}

export async function answersByDay(clientId: string, days = 7) {
  const period = clampDays(days, 7);
  const since = rangeStart(period);
  const dayKey = sql<string>`to_char((${responses.completedAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day: dayKey,
      total: count(),
    })
    .from(responses)
    .where(and(eq(responses.clientId, clientId), gte(responses.completedAt, since)))
    .groupBy(dayKey);
  const byDay = new Map(rows.map((row) => [row.day, Number(row.total)]));
  const items: { date: string; count: number }[] = [];
  for (let i = 0; i < period; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = utcDayKey(day);
    items.push({ date: key, count: byDay.get(key) || 0 });
  }
  return {
    days: period,
    total: items.reduce((sum, row) => sum + row.count, 0),
    items,
  };
}
