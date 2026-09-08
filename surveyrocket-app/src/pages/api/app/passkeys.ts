import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "../../../lib/access";
import { db } from "../../../lib/db";
import { userPasskeys } from "../../../lib/schema";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const rows = await db
    .select()
    .from(userPasskeys)
    .where(eq(userPasskeys.userId, locals.user.id))
    .orderBy(desc(userPasskeys.createdAt));
  return jsonOk({ passkeys: rows });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  const label = String(body?.label || "Passkey").trim() || "Passkey";
  const [row] = await db.insert(userPasskeys).values({ userId: locals.user.id, label }).returning();
  return jsonOk({ passkey: row });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return jsonError(400, "id required");
  await db.delete(userPasskeys).where(eq(userPasskeys.id, id));
  return jsonOk({ ok: true });
};
