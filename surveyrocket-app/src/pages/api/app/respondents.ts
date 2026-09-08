import type { APIRoute } from "astro";
import { and, desc, eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { answers, respondents, responses, surveys } from "../../../lib/schema";
import { getConnection } from "../../../lib/hubspot/tokens";

export const GET: APIRoute = async ({ url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const surveyId = url.searchParams.get("survey") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return jsonError(access.status, access.error);
  const [sv] = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.id, surveyId), eq(surveys.clientId, access.client.id)))
    .limit(1);
  if (!sv) return jsonError(404, "Survey not found");
  const conn = await getConnection(access.client.id);
  const rows = await db
    .select({
      response: responses,
      respondent: respondents,
    })
    .from(responses)
    .leftJoin(respondents, eq(responses.respondentId, respondents.id))
    .where(eq(responses.surveyId, sv.id))
    .orderBy(desc(responses.completedAt))
    .limit(500);
  const ids = rows.map((r) => r.response.id);
  const ans = ids.length
    ? await db.select().from(answers).where(eq(answers.surveyId, sv.id))
    : [];
  const byResponse = new Map<string, typeof ans>();
  for (const a of ans) {
    const list = byResponse.get(a.responseId) || [];
    list.push(a);
    byResponse.set(a.responseId, list);
  }
  return jsonOk({
    respondents: rows.map((r) => ({
      id: r.response.id,
      name: r.respondent?.name || (r.response.record as { respondent?: { name?: string } })?.respondent?.name || null,
      email: r.respondent?.email || (r.response.record as { respondent?: { email?: string } })?.respondent?.email || null,
      submittedAt: r.response.completedAt,
      country: r.response.country,
      reviewOutcome: r.response.reviewOutcome,
      hubspotContactId: r.respondent?.hubspotContactId || null,
      hubspotUrl:
        conn?.portalId && r.respondent?.hubspotContactId
          ? `https://app.hubspot.com/contacts/${conn.portalId}/record/0-1/${r.respondent.hubspotContactId}`
          : null,
      answers: (byResponse.get(r.response.id) || []).map((a) => ({
        questionKey: a.questionKey,
        questionText: a.questionText,
        type: a.type,
        valueText: a.valueText,
        valueNumber: a.valueNumber,
        valueList: a.valueList,
        skipped: a.skipped,
      })),
    })),
  });
};
