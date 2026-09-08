import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { surveys } from "../../../lib/schema";
import { blankDefinition } from "../../../lib/definition";
import { publicId, slugify } from "../../../lib/ids";

export const GET: APIRoute = async ({ url, locals }) => {
  const slug = url.searchParams.get("client");
  if (!slug) return jsonError(400, "client required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, slug);
  if (!access.ok) return jsonError(access.status, access.error);
  const list = await db
    .select()
    .from(surveys)
    .where(eq(surveys.clientId, access.client.id))
    .orderBy(desc(surveys.updatedAt));
  return jsonOk({ surveys: list });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client) return jsonError(400, "client required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  const name = String(body.name || "Untitled survey");
  let slug = slugify(body.slug || name);
  const existing = await db.select({ slug: surveys.slug }).from(surveys).where(eq(surveys.clientId, access.client.id));
  const used = new Set(existing.map((s) => s.slug));
  if (used.has(slug)) {
    let n = 2;
    while (used.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  const definition = blankDefinition({
    id: slug,
    name,
    cadence: body.cadence || null,
    status: "Draft",
    questions: body.questions || [
      { id: "q1", type: "choice", q: "Your first question goes here.", options: ["Option A", "Option B"] },
    ],
    settings: body.settings,
    provenance: body.provenance || { source: body.source || "hand", drafted_by: body.drafted_by || null, approved_by: null, approved_at: null },
  });
  const [row] = await db
    .insert(surveys)
    .values({
      clientId: access.client.id,
      publicId: publicId(),
      slug,
      name,
      cadence: definition.cadence,
      status: "Draft",
      intro: definition.intro,
      outro: definition.outro,
      settings: definition.settings,
      provenance: definition.provenance,
      definition,
    })
    .returning();
  return jsonOk({ survey: row }, 201);
};
