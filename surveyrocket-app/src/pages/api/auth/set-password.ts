import type { APIRoute } from "astro";
import { publicAuthMessage } from "../../../lib/auth-messages";
import { persistSessionCookies, plainAuthClient, sessionFromCookies } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  const fail = (error: string) =>
    redirect("/auth/set-password?error=" + encodeURIComponent(publicAuthMessage(error)));
  if (password.length < 8) return fail("Use at least 8 characters.");
  if (password !== confirm) return fail("Passwords do not match.");
  const session = sessionFromCookies(cookies);
  if (!session?.access_token || !session.refresh_token) {
    return fail("Open the link from your email to choose a password.");
  }
  const auth = plainAuthClient();
  const { error: sessionError } = await auth.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) return fail(sessionError.message);
  const { data, error } = await auth.auth.updateUser({ password });
  if (error) return fail(error.message);
  if (data.session) persistSessionCookies(cookies, data.session);
  return redirect("/app");
};
