import type { APIRoute } from "astro";
import { jsonError, jsonOk, membersForClient, requireClientAccess } from "../../../lib/access";
import { inviteUserToClient } from "../../../lib/invite";
import { db } from "../../../lib/db";
import { clientMembers } from "../../../lib/schema";
import { and, eq } from "drizzle-orm";

export const GET: APIRoute = async ({ url, locals }) => {
  const clientSlug = url.searchParams.get("client") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, clientSlug);
  if (!access.ok) return jsonError(access.status, access.error);
  return jsonOk({ members: await membersForClient(access.client.id) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client || !body?.email) return jsonError(400, "client and email required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  try {
    await inviteUserToClient(String(body.email), access.client.id);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not invite user");
  }
  return jsonOk({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body?.client || !body?.userId) return jsonError(400, "client and userId required");
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, body.client);
  if (!access.ok) return jsonError(access.status, access.error);
  if (body.userId === locals.user!.id) return jsonError(400, "You cannot remove yourself.");
  await db
    .delete(clientMembers)
    .where(and(eq(clientMembers.clientId, access.client.id), eq(clientMembers.userId, String(body.userId))));
  return jsonOk({ ok: true });
};
