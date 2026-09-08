import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { clients } from "../../../lib/schema";
import { getConnection, publicConnection } from "../../../lib/hubspot/tokens";

export const GET: APIRoute = async ({ url, locals }) => {
  const slug = url.searchParams.get("client") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, slug);
  if (!access.ok) return jsonError(access.status, access.error);
  const conn = await getConnection(access.client.id);
  return jsonOk({ client: access.client, hubspot: publicConnection(conn) });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client) return jsonError(400, "client required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  const [row] = await db
    .update(clients)
    .set({
      name: body.name ?? access.client.name,
      logoUrl: body.logoUrl === undefined ? access.client.logoUrl : body.logoUrl,
      reviewLinks: body.reviewLinks ?? access.client.reviewLinks,
    })
    .where(eq(clients.id, access.client.id))
    .returning();
  return jsonOk({ client: row });
};
