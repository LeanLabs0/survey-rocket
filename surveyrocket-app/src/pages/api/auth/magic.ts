import type { APIRoute } from "astro";
import { parseOtpWaitSeconds, safeNextPath, siteUrl, supabaseFromCookies } from "../../../lib/supabase";

function wantsJson(request: Request) {
  return (request.headers.get("accept") || "").includes("application/json");
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  const next = safeNextPath(String(form.get("next") || "/app"));
  const json = wantsJson(request);

  const fail = (message: string, waitSeconds: number | null = null) => {
    if (json) {
      return new Response(JSON.stringify({ error: message, waitSeconds }), {
        status: waitSeconds ? 429 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const params = new URLSearchParams({
      method: "magic",
      email,
      next,
      error: message,
    });
    if (waitSeconds) params.set("wait", String(waitSeconds));
    return new Response(null, { status: 302, headers: { Location: `/login?${params}` } });
  };

  if (!email) return fail("Enter your work email.", null);

  const supabase = supabaseFromCookies(cookies, request);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    const wait = parseOtpWaitSeconds(error.message);
    return fail(error.message, wait);
  }
  if (json) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const params = new URLSearchParams({ method: "magic", email, next, sent: "1" });
  return new Response(null, { status: 302, headers: { Location: `/login?${params}` } });
};
