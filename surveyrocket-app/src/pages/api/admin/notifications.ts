import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/access";
import { notifySystemUpdate } from "../../../lib/notifications";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.isSuperadmin) return jsonError(403, "Superadmin only");
  const body = await request.json().catch(() => null);
  const title = String(body?.title || "").trim();
  if (!title) return jsonError(400, "title required");
  const created = await notifySystemUpdate({
    title,
    body: body?.body ? String(body.body) : null,
    href: body?.href ? String(body.href) : null,
    clientId: body?.clientId ? String(body.clientId) : undefined,
  });
  return jsonOk({ ok: true, count: created.length });
};
