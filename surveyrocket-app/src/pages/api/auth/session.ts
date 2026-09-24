import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/access";
import { isPendingInviteEmail } from "../../../lib/invite";
import { persistSessionCookies, plainAuthClient } from "../../../lib/supabase";
import { touchSession } from "../../../lib/sessions";

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const accessToken = String(body?.access_token || "");
  const refreshToken = String(body?.refresh_token || "");
  if (!accessToken || !refreshToken) return jsonError(400, "Missing session tokens");
  const auth = plainAuthClient();
  const { data, error } = await auth.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) return jsonError(401, error?.message || "This link expired.");
  persistSessionCookies(cookies, data.session);
  if (data.session.user?.id) {
    await touchSession(data.session.user.id, cookies, request).catch(() => null);
  }
  const needsPassword = data.session.user?.email
    ? await isPendingInviteEmail(data.session.user.email).catch(() => false)
    : false;
  return jsonOk({ ok: true, needsPassword });
};
