import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { aggregateSurvey, loadClientDashboard } from "../../../lib/aggregates";
import { db } from "../../../lib/db";
import { surveys } from "../../../lib/schema";
import { ownedLiveSurvey } from "../../../lib/survey-scope";

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
      .where(ownedLiveSurvey(access.client.id, surveyId))
      .limit(1);
    if (!sv) return jsonError(404, "Survey not found");
    const agg = await aggregateSurvey(sv.id);
    return jsonOk({ survey: sv, agg });
  }
  const surveyDays = parseDays(url.searchParams.get("surveyDays"), 30);
  const seriesDays = parseDays(url.searchParams.get("seriesDays"), 7);
  return jsonOk(await loadClientDashboard(access.client.id, surveyDays, seriesDays));
};
