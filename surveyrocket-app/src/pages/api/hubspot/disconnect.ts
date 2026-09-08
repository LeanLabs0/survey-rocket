import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { hubspotConnections } from "../../../lib/schema";

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client) return jsonError(400, "client required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  await db.delete(hubspotConnections).where(eq(hubspotConnections.clientId, access.client.id));
  return jsonOk({ ok: true });
};
