import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/access";
import { signInWithPasswordDirect, supabaseFromCookies } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user?.email) return jsonError(401, "Sign in required");
  const body = await request.json().catch(() => null);
  const current = String(body?.current || "");
  const next = String(body?.next || "");
  if (next.length < 8) return jsonError(400, "Use at least 8 characters.");
  if (!/[a-z]/.test(next) || !/[A-Z]/.test(next)) return jsonError(400, "Use upper and lowercase letters.");
  if (!/\d/.test(next)) return jsonError(400, "Include a number.");
  if (!/[^A-Za-z0-9]/.test(next)) return jsonError(400, "Include a special character.");
  try {
    await signInWithPasswordDirect(locals.user.email, current);
  } catch {
    return jsonError(400, "Current password is incorrect.");
  }
  const supabase = supabaseFromCookies(cookies, request);
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return jsonError(400, error.message);
  return jsonOk({ ok: true });
};
