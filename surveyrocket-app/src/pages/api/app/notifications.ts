import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { profiles } from "../../../lib/schema";
import { eq } from "drizzle-orm";
import { listNotifications, markNotificationsRead, dismissNotifications } from "../../../lib/notifications";

export const GET: APIRoute = async ({ url, locals }) => {
  const slug = url.searchParams.get("client") || "";
  const access = await requireClientAccess(locals.user, locals.isSuperadmin, slug);
  if (!access.ok) return jsonError(access.status, access.error);
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, locals.user!.id)).limit(1);
  const notifyReviews = profile?.notifyReviews !== false;
  const items = await listNotifications(access.client.id, locals.user!.id, notifyReviews);
  return jsonOk({ notifications: items, unread: items.filter((n) => !n.read).length, enabled: notifyReviews });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (body?.dismiss) await dismissNotifications(locals.user.id, ids);
  else await markNotificationsRead(locals.user.id, ids);
  return jsonOk({ ok: true });
};
