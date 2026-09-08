import type { APIRoute } from "astro";
import { passwordSetupPath, publicAuthMessage } from "../../../lib/auth-messages";
import { plainAuthClient, safeNextPath, siteUrl } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  const next = safeNextPath(String(form.get("next") || "/app"));
  const back = (qs: string) =>
    redirect(`/login?method=password&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&${qs}`);
  if (!email) return back("error=" + encodeURIComponent("Enter your work email to set a password."));
  const { error } = await plainAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(passwordSetupPath())}`,
  });
  if (error) return back("error=" + encodeURIComponent(publicAuthMessage(error.message)));
  return back("reset=1");
};
