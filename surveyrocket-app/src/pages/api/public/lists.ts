import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { respondents, surveys } from "../../../lib/schema";
import { enrollContactToSurveyLists } from "../../../lib/hubspot/lists";
import { resolveAccessToken } from "../../../lib/hubspot/tokens";
import { acceptContact } from "../../../lib/link-identity";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return json({ ok: false, error: "invalid" }, 400);
  const body = payload as Record<string, unknown>;
  const identity = body.identity && typeof body.identity === "object" ? (body.identity as Record<string, unknown>) : {};
  const publicId = str(body.publicId || body.survey_id);
  const whichRaw = str(body.which || body.stage).toLowerCase();
  const which =
    whichRaw === "completed" || whichRaw === "complete"
      ? ("completed" as const)
      : whichRaw === "signedin" || whichRaw === "signed_in"
        ? ("signedIn" as const)
        : null;
  const contact = acceptContact({
    email: body.email || identity.email,
    firstname: body.firstname || identity.firstname,
    lastname: body.lastname || identity.lastname,
    company: body.company || identity.company,
    website: body.website || identity.website,
  });
  if (!publicId || !which || !contact) return json({ ok: false, error: "invalid" }, 400);

  const [sv] = await db.select().from(surveys).where(eq(surveys.publicId, publicId)).limit(1);
  if (!sv || sv.deletedAt) return json({ ok: false, error: "survey not found" }, 404);
  if (!(await resolveAccessToken(sv.clientId))) return json({ ok: false, error: "HubSpot not connected" }, 409);

  const extras = {
    firstname: contact.firstname || undefined,
    lastname: contact.lastname || undefined,
    company: contact.company || undefined,
    website: contact.website || undefined,
  };

  const [person] = await db
    .select()
    .from(respondents)
    .where(and(eq(respondents.clientId, sv.clientId), eq(respondents.email, contact.email)))
    .limit(1);

  try {
    await enrollContactToSurveyLists(sv, contact.email, which, extras, person?.id || null);
    return json({ ok: true, which });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("hubspot lists enroll", message);
    return json({ ok: false, error: "HubSpot enrollment failed" }, 502);
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
