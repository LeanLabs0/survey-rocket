import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { answersByDay, answersBySurvey, aggregateSurvey, clientDashboardStats } from "../../../lib/aggregates";
import { db } from "../../../lib/db";
import { surveys } from "../../../lib/schema";
import { and, eq } from "drizzle-orm";

function parseDays(raw: string | null, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(90, Math.round(n));
}

export const GET: APIRoute = async ({ url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const surveyId = url.searchParams.get("survey");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return jsonError(access.status, access.error);
  if (surveyId) {
    const [sv] = await db
      .select()
      .from(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.clientId, access.client.id)))
      .limit(1);
    if (!sv) return jsonError(404, "Survey not found");
    const agg = await aggregateSurvey(sv.id);
    return jsonOk({ survey: sv, agg });
  }
  const surveyDays = parseDays(url.searchParams.get("surveyDays"), 30);
  const seriesDays = parseDays(url.searchParams.get("seriesDays"), 7);
  const [dash, bySurvey, byDay] = await Promise.all([
    clientDashboardStats(access.client.id),
    answersBySurvey(access.client.id, surveyDays),
    answersByDay(access.client.id, seriesDays),
  ]);
  return jsonOk({
    total: dash.total,
    week: dash.week,
    clicked: dash.clicked,
    asked: dash.asked,
    verified: dash.verified,
    bySurvey,
    byDay,
    surveys: dash.surveys.map((it) => {
      const def = it.survey.definition as { questions?: unknown[] };
      return {
        id: it.survey.id,
        publicId: it.survey.publicId,
        name: it.survey.name,
        status: it.survey.status,
        cadence: it.survey.cadence,
        questionCount: Array.isArray(def?.questions) ? def.questions.length : 0,
        updatedAt: it.survey.updatedAt,
        agg: it.agg,
        stats: it.stats,
      };
    }),
  });
};
