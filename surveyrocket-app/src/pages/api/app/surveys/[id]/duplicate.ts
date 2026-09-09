import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireClientAccess } from "../../../../../lib/access";
import { db } from "../../../../../lib/db";
import { surveys } from "../../../../../lib/schema";
import { publicId, slugify } from "../../../../../lib/ids";
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
  const name = `${sv.name} (copy)`;
  const slug = slugify(name) + "-" + publicId().slice(0, 4);
  const definition = {
    ...(sv.definition as Record<string, unknown>),
    id: slug,
    name,
    status: "Draft",
  };
  const [row] = await db
    .insert(surveys)
    .values({
      clientId: access.client.id,
      publicId: publicId(),
      slug,
      name,
      cadence: sv.cadence,
      status: "Draft",
      intro: sv.intro,
      outro: sv.outro,
      settings: sv.settings,
      provenance: { source: "hand", drafted_by: null, approved_by: null, approved_at: null },
      definition,
    })
    .returning();
  if (row) provisionSurveyLists(row);
  return jsonOk({ survey: row }, 201);
};
