import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../../lib/access";
import { db } from "../../../../lib/db";
import { surveys } from "../../../../lib/schema";
import { validateDefinition, type SurveyDefinition } from "../../../../lib/definition";

async function loadOwned(locals: App.Locals, id: string, clientSlug: string) {
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return access;
  const [sv] = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.id, id), eq(surveys.clientId, access.client.id)))
    .limit(1);
  if (!sv) return { ok: false as const, status: 404, error: "Survey not found" };
  return { ok: true as const, client: access.client, survey: sv };
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const loaded = await loadOwned(locals, params.id!, clientSlug);
  if (!loaded.ok) return jsonError(loaded.status, loaded.error);
  return jsonOk({ survey: loaded.survey });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client) return jsonError(400, "client required");
  const loaded = await loadOwned(locals, params.id!, body.client);
  if (!loaded.ok) return jsonError(loaded.status, loaded.error);
  const definition = body.definition as SurveyDefinition;
  if (!definition) return jsonError(400, "definition required");
  const err = validateDefinition(definition);
  if (err && body.publish) return jsonError(400, err);
  const [row] = await db
    .update(surveys)
    .set({
      name: definition.name,
      cadence: definition.cadence,
      status: definition.status,
      intro: definition.intro,
      outro: definition.outro,
      settings: definition.settings,
      provenance: definition.provenance,
      definition,
      updatedAt: new Date(),
    })
    .where(eq(surveys.id, loaded.survey.id))
    .returning();
  return jsonOk({ survey: row });
};

export const DELETE: APIRoute = async ({ params, url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const loaded = await loadOwned(locals, params.id!, clientSlug);
  if (!loaded.ok) return jsonError(loaded.status, loaded.error);
  await db.delete(surveys).where(eq(surveys.id, loaded.survey.id));
  return jsonOk({ ok: true });
};
