import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { scans, surveys } from "../../../lib/schema";
import { factor8Scan } from "../../../lib/factor8";
import { blankDefinition } from "../../../lib/definition";
import { publicId, slugify } from "../../../lib/ids";
import { provisionSurveyLists } from "../../../lib/hubspot/lists";

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client || !body?.url) return jsonError(400, "client and url required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  let url = String(body.url).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const [scan] = await db
    .insert(scans)
    .values({
      clientId: access.client.id,
      url,
      targetStat: body.target_stat || null,
      status: "running",
      createdBy: locals.user!.id,
    })
    .returning();
  try {
    const out = await factor8Scan({
      url,
      single_page: true,
      target_stat: body.target_stat || undefined,
    });
    const gaps = out.data?.gaps || [];
    await db
      .update(scans)
      .set({ status: out.ok ? "done" : "failed", gaps })
      .where(eq(scans.id, scan.id));
    return jsonOk({ scanId: scan.id, gaps, error: out.ok ? null : out.data?.error || "scan_failed" });
  } catch {
    await db.update(scans).set({ status: "failed" }).where(eq(scans.id, scan.id));
    return jsonError(504, "The scan timed out. Wait a minute and try again.");
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client || !body?.gap) return jsonError(400, "client and gap required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  const gap = body.gap as {
    survey_name?: string;
    questions?: Array<Record<string, unknown>>;
  };
  const name = gap.survey_name || "Scanned survey";
  const slug = slugify(name) + "-" + publicId().slice(0, 4);
  const questions = (gap.questions || []).map((q, i) => ({
    id: String(q.id || `q${i + 1}`),
    type: (q.type as "choice" | "multi" | "number" | "text") || "text",
    q: String(q.q || "").replace(/\u2013|\u2014/g, ", "),
    options: (q.options as string[]) || undefined,
    nps: !!q.nps,
    min: typeof q.min === "number" ? q.min : undefined,
    max: typeof q.max === "number" ? q.max : undefined,
    optional: q.optional !== false,
  }));
  const definition = blankDefinition({
    id: slug,
    name,
    cadence: "Draft",
    status: "Draft",
    questions,
    provenance: { source: "scan", drafted_by: "survey-rocket-designer", approved_by: null, approved_at: null },
  });
  const [row] = await db
    .insert(surveys)
    .values({
      clientId: access.client.id,
      publicId: publicId(),
      slug,
      name,
      cadence: "Draft",
      status: "Draft",
      settings: definition.settings,
      provenance: definition.provenance,
      definition,
    })
    .returning();
  if (row) provisionSurveyLists(row);
  return jsonOk({ survey: row }, 201);
};
