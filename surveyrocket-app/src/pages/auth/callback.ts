import type { APIRoute } from "astro";
import type { EmailOtpType } from "@supabase/supabase-js";
import { passwordSetupPath } from "../../lib/auth-messages";
import { persistSessionCookies, plainAuthClient, safeNextPath, supabaseFromCookies } from "../../lib/supabase";

const SETUP_TYPES = new Set(["invite", "recovery", "signup"]);

export const GET: APIRoute = async ({ url, request, cookies, redirect }) => {
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const token = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const auth = plainAuthClient();

  if (code) {
    const { data } = await auth.auth.exchangeCodeForSession(code);
    if (data.session) persistSessionCookies(cookies, data.session);
  }

  if (token && type) {
    const { data } = await auth.auth.verifyOtp({ token_hash: token, type });
    if (data.session) persistSessionCookies(cookies, data.session);
    else {
      const supabase = supabaseFromCookies(cookies, request);
      await supabase.auth.verifyOtp({ token_hash: token, type });
    }
    if (SETUP_TYPES.has(type)) return redirect(passwordSetupPath());
  }

  if (SETUP_TYPES.has(type || "") && next === "/app") return redirect(passwordSetupPath());
  return redirect(next);
};
