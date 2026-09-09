import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../../../lib/access";
import { db } from "../../../../../lib/db";
import { surveyPublications, surveys } from "../../../../../lib/schema";
import { validateDefinition, type SurveyDefinition } from "../../../../../lib/definition";
import { provisionSurveyLists } from "../../../../../lib/hubspot/lists";
import { ownedLiveSurvey } from "../../../../../lib/survey-scope";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client) return jsonError(400, "client required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  const [sv] = await db
    .select()
    .from(surveys)
    .where(ownedLiveSurvey(access.client.id, params.id!))
    .limit(1);
  if (!sv) return jsonError(404, "Survey not found");
  const definition = (body.definition || sv.definition) as SurveyDefinition;
  const err = validateDefinition({ ...definition, status: "Active", provenance: { ...definition.provenance, approved_by: locals.profile?.fullName || locals.user?.email || "operator", approved_at: new Date().toISOString() } });
  if (err) return jsonError(400, err);
  const approved = {
    ...definition,
    status: "Active" as const,
    provenance: {
      ...definition.provenance,
      approved_by: locals.profile?.fullName || locals.user?.email || "operator",
      approved_at: new Date().toISOString(),
    },
  };
  const [latest] = await db
    .select()
    .from(surveyPublications)
    .where(eq(surveyPublications.surveyId, sv.id))
    .orderBy(desc(surveyPublications.version))
    .limit(1);
  const version = (latest?.version || 0) + 1;
  const [pub] = await db
    .insert(surveyPublications)
    .values({
      surveyId: sv.id,
      version,
      definition: approved,
      publishedBy: locals.user!.id,
    })
    .returning();
  const [row] = await db
    .update(surveys)
    .set({
      name: approved.name,
      cadence: approved.cadence,
      status: "Active",
      intro: approved.intro,
      outro: approved.outro,
      settings: approved.settings,
      provenance: approved.provenance,
      definition: approved,
      updatedAt: new Date(),
    })
    .where(eq(surveys.id, sv.id))
    .returning();
  if (row) provisionSurveyLists(row);
  return jsonOk({ survey: row, publication: pub });
};
