import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk, invalidateProfileCache } from "../../../lib/access";
import { db } from "../../../lib/db";
import { profiles } from "../../../lib/schema";
import { supabaseFromCookies } from "../../../lib/supabase";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { signInWithPasswordDirect } from "../../../lib/supabase";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const [row] = await db.select().from(profiles).where(eq(profiles.id, locals.user.id)).limit(1);
  return jsonOk({
    profile: row || {
      id: locals.user.id,
      email: locals.user.email,
      fullName: locals.profile?.fullName || null,
      avatarUrl: locals.profile?.avatarUrl || null,
      theme: locals.profile?.theme || "dark",
      locale: locals.profile?.locale || "en",
      notifyReviews: locals.profile?.notifyReviews !== false,
    },
  });
};

export const PUT: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Invalid body");
  const [current] = await db.select().from(profiles).where(eq(profiles.id, locals.user.id)).limit(1);
  const theme = body.theme === "light" || body.theme === "system" ? body.theme : "dark";
  const locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim().slice(0, 12) : current?.locale || "en";
  const fullName = body.fullName === undefined ? current?.fullName : String(body.fullName || "").trim() || null;
  const notifyReviews = body.notifyReviews === undefined ? current?.notifyReviews !== false : Boolean(body.notifyReviews);

  const [row] = await db
    .insert(profiles)
    .values({
      id: locals.user.id,
      email: locals.user.email || current?.email || "",
      fullName,
      avatarUrl: current?.avatarUrl || null,
      theme,
      locale,
      notifyReviews,
      isSuperadmin: current?.isSuperadmin || false,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { fullName, theme, locale, notifyReviews },
    })
    .returning();

  invalidateProfileCache(locals.user.id);

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && email !== (locals.user.email || "").toLowerCase()) {
      const supabase = supabaseFromCookies(cookies, request);
      const { error } = await supabase.auth.updateUser({ email });
      if (error) return jsonError(400, error.message);
    }
  }

  return jsonOk({ profile: row, emailPending: Boolean(body.email && body.email !== locals.user.email) });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  if (locals.isSuperadmin) return jsonError(403, "A superadmin account cannot be deleted from a client portal.");
  const body = await request.json().catch(() => null);
  const password = String(body?.password || "");
  if (!password) return jsonError(400, "Enter your password to confirm.");
  const email = locals.user.email;
  if (!email) return jsonError(400, "This account has no email.");
  try {
    await signInWithPasswordDirect(email, password);
  } catch {
    return jsonError(400, "Password is incorrect.");
  }
  const { error } = await supabaseAdmin().auth.admin.deleteUser(locals.user.id);
  if (error) return jsonError(400, error.message);
  return jsonOk({ ok: true });
};
