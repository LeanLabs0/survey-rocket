import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/access";
import { currentTokenHash, listSessions, revokeSession, touchSession } from "../../../lib/sessions";

export const GET: APIRoute = async ({ locals, cookies, request }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  await touchSession(locals.user.id, cookies, request).catch(() => null);
  const sessions = await listSessions(locals.user.id, currentTokenHash(cookies));
  return jsonOk({ sessions });
};

export const DELETE: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return jsonError(400, "id required");
  const current = (await listSessions(locals.user.id, currentTokenHash(cookies))).find((s) => s.id === id);
  await revokeSession(locals.user.id, id);
  return jsonOk({ ok: true, current: Boolean(current?.current) });
};
