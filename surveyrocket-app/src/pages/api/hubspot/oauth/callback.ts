import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { hubspotConnections } from "../../../../lib/schema";
import { encrypt } from "../../../../lib/crypto";
import { exchangeCodeForTokens, getTokenInfo, missingContactScopes } from "../../../../lib/hubspot/oauth";
import { ensureLeadForm, saveSigninFormId } from "../../../../lib/hubspot/provision";
import { ensureClientSurveyLists } from "../../../../lib/hubspot/lists";

export const GET: APIRoute = async ({ url }) => {
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";
  let state: { clientId?: string; slug?: string; uid?: string } = {};
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
  } catch {
    /* ignore */
  }
  const back = `/app/${state.slug || ""}/settings`;
  if (err || !code || !state.clientId) {
    return new Response(null, { status: 302, headers: { Location: `${back}?hs=error` } });
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await getTokenInfo(tokens.access_token);
    let signinFormId: string | null = null;
    try {
      const form = await ensureLeadForm(tokens.access_token);
      signinFormId = form.id;
    } catch (formErr) {
      console.error("hubspot sign-in form", formErr);
    }
    await db
      .insert(hubspotConnections)
      .values({
        clientId: state.clientId,
        portalId: info.hub_id ? String(info.hub_id) : null,
        portalName: info.hub_domain || null,
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        accessTokenEnc: encrypt(tokens.access_token),
        expiresAt: new Date(Date.now() + Number(tokens.expires_in || 1800) * 1000),
        scopes: (info.scopes || []).join(" "),
        signinFormId,
        status: "connected",
        connectedBy: state.uid || null,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: hubspotConnections.clientId,
        set: {
          portalId: info.hub_id ? String(info.hub_id) : null,
          portalName: info.hub_domain || null,
          refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
          accessTokenEnc: encrypt(tokens.access_token),
          expiresAt: new Date(Date.now() + Number(tokens.expires_in || 1800) * 1000),
          scopes: (info.scopes || []).join(" "),
          signinFormId: signinFormId || undefined,
          status: "connected",
          connectedBy: state.uid || null,
          connectedAt: new Date(),
        },
      });
    if (signinFormId) await saveSigninFormId(state.clientId, signinFormId);
    ensureClientSurveyLists(state.clientId).catch((err) => console.error("hubspot lists", err));
    const missing = missingContactScopes(info.scopes);
    return new Response(null, {
      status: 302,
      headers: { Location: `${back}?hs=${missing.length ? "scopes" : "connected"}` },
    });
  } catch (e) {
    console.error(e);
    return new Response(null, { status: 302, headers: { Location: `${back}?hs=error` } });
  }
};
