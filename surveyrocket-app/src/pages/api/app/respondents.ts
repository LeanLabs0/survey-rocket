import type { APIRoute } from "astro";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { answers, respondents, responses, surveys } from "../../../lib/schema";
import { getConnection } from "../../../lib/hubspot/tokens";
import { hubspotContactRecordUrl, lookupContactIdsByEmails } from "../../../lib/hubspot/lists";
import { ownedLiveSurvey } from "../../../lib/survey-scope";

export const GET: APIRoute = async ({ url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const surveyId = url.searchParams.get("survey") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return jsonError(access.status, access.error);
  const [[sv], conn] = await Promise.all([
    db
      .select()
      .from(surveys)
      .where(ownedLiveSurvey(access.client.id, surveyId))
      .limit(1),
    getConnection(access.client.id),
  ]);
  if (!sv) return jsonError(404, "Survey not found");
  const questionCount = Array.isArray((sv.definition as { questions?: unknown[] })?.questions)
    ? (sv.definition as { questions: unknown[] }).questions.length
    : 0;
  const rows = await db
    .select({
      response: responses,
      respondent: respondents,
    })
    .from(responses)
    .leftJoin(respondents, eq(responses.respondentId, respondents.id))
    .where(eq(responses.surveyId, sv.id))
    .orderBy(desc(sql`coalesce(${responses.completedAt}, ${responses.startedAt})`))
    .limit(500);
  const ids = rows.map((r) => r.response.id);
  const ans = ids.length
    ? await db.select().from(answers).where(inArray(answers.responseId, ids))
    : [];
  const byResponse = new Map<string, typeof ans>();
  for (const a of ans) {
    const list = byResponse.get(a.responseId) || [];
    list.push(a);
    byResponse.set(a.responseId, list);
  }

  const emailOf = (r: (typeof rows)[number]) =>
    (r.respondent?.email || (r.response.record as { respondent?: { email?: string } })?.respondent?.email || "")
      .trim()
      .toLowerCase();

  const missingEmails = [
    ...new Set(rows.filter((r) => !r.respondent?.hubspotContactId && emailOf(r).includes("@")).map(emailOf)),
  ];
  let lookedUp = new Map<string, string>();
  if (missingEmails.length) {
    try {
      lookedUp = await lookupContactIdsByEmails(access.client.id, missingEmails);
    } catch (err) {
      console.error("hubspot contact lookup", err);
    }
  }
  const persist = rows.filter((r) => {
    const email = emailOf(r);
    return r.respondent && !r.respondent.hubspotContactId && email && lookedUp.has(email);
  });
  if (persist.length) {
    await Promise.all(
      persist.map((r) =>
        db
          .update(respondents)
          .set({ hubspotContactId: lookedUp.get(emailOf(r))!, lastSeenAt: new Date() })
          .where(eq(respondents.id, r.respondent!.id)),
      ),
    );
  }

  return jsonOk({
    questionCount,
    respondents: rows.map((r) => {
      const list = byResponse.get(r.response.id) || [];
      const answered = list.filter((a) => !a.skipped).length;
      const total = questionCount || list.length;
      const percent = r.response.completedAt ? 100 : total ? Math.min(100, Math.round((answered / total) * 100)) : 0;
      const email = emailOf(r) || null;
      const contactId = r.respondent?.hubspotContactId || (email ? lookedUp.get(email) : null) || null;
      return {
        id: r.response.id,
        name: r.respondent?.name || (r.response.record as { respondent?: { name?: string } })?.respondent?.name || null,
        email,
        submittedAt: r.response.completedAt || r.response.startedAt,
        completed: Boolean(r.response.completedAt),
        progress: { answered, total, percent },
        country: r.response.country,
        reviewOutcome: r.response.reviewOutcome,
        hubspotContactId: contactId,
        hubspotUrl: hubspotContactRecordUrl(conn?.portalId, contactId),
        answers: list.map((a) => ({
          questionKey: a.questionKey,
          questionText: a.questionText,
          type: a.type,
          nps: a.nps,
          valueText: a.valueText,
          valueNumber: a.valueNumber,
          valueList: a.valueList,
          skipped: a.skipped,
        })),
      };
    }),
  });
};
