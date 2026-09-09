import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { jsonError, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { answers, respondents, responses, surveys } from "../../../lib/schema";
import { ownedLiveSurvey } from "../../../lib/survey-scope";

export const GET: APIRoute = async ({ url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const surveyId = url.searchParams.get("survey") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return jsonError(access.status, access.error);
  const [sv] = await db
    .select()
    .from(surveys)
    .where(ownedLiveSurvey(access.client.id, surveyId))
    .limit(1);
  if (!sv) return jsonError(404, "Survey not found");
  const rows = await db
    .select({ response: responses, respondent: respondents })
    .from(responses)
    .leftJoin(respondents, eq(responses.respondentId, respondents.id))
    .where(eq(responses.surveyId, sv.id))
    .orderBy(desc(responses.completedAt));
  const ans = await db.select().from(answers).where(eq(answers.surveyId, sv.id));
  const keys = [...new Set(ans.map((a) => a.questionKey))];
  const header = ["name", "email", "submitted_at", "country", "review_outcome", ...keys];
  const lines = [header.join(",")];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  for (const r of rows) {
    const rec = r.response.record as { respondent?: { name?: string; email?: string } };
    const map = new Map(ans.filter((a) => a.responseId === r.response.id).map((a) => [a.questionKey, a]));
    const cells = [
      r.respondent?.name || rec.respondent?.name || "",
      r.respondent?.email || rec.respondent?.email || "",
      r.response.completedAt?.toISOString() || "",
      r.response.country || "",
      r.response.reviewOutcome || "",
      ...keys.map((k) => {
        const a = map.get(k);
        if (!a || a.skipped) return "";
        if (a.valueList) return a.valueList.join("; ");
        if (a.valueNumber !== null && a.valueNumber !== undefined) return String(a.valueNumber);
        return a.valueText || "";
      }),
    ];
    lines.push(cells.map(esc).join(","));
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sv.slug}-results.csv"`,
    },
  });
};
