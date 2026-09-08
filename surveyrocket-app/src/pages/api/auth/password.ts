import type { APIRoute } from "astro";
import { publicAuthMessage } from "../../../lib/auth-messages";
import { persistSessionCookies, safeNextPath, signInWithPasswordDirect, supabasePublishableKey, supabaseUrl } from "../../../lib/supabase";
import { touchSession } from "../../../lib/sessions";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const next = safeNextPath(String(form.get("next") || "/app"));
  const back = (error: string) =>
    redirect(
      `/login?method=password&email=${encodeURIComponent(email)}&error=${encodeURIComponent(publicAuthMessage(error))}&next=${encodeURIComponent(next)}`,
    );
  if (!email || !password) return back("Enter your email and password.");

  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) return back("Sign-in is not configured on this environment.");

  try {
    const session = await signInWithPasswordDirect(email, password);
    persistSessionCookies(cookies, session);
    if (session.user?.id) await touchSession(session.user.id, cookies, request).catch(() => null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign in.";
    console.error("password sign-in failed", message);
    return back(message);
  }
  return redirect(next);
};
