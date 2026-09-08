import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { hubspotConnections } from "../../../../lib/schema";
import { encrypt } from "../../../../lib/crypto";
import { exchangeCodeForTokens, getTokenInfo } from "../../../../lib/hubspot/oauth";

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
          status: "connected",
          connectedBy: state.uid || null,
          connectedAt: new Date(),
        },
      });
    return new Response(null, { status: 302, headers: { Location: `${back}?hs=connected` } });
  } catch (e) {
    console.error(e);
    return new Response(null, { status: 302, headers: { Location: `${back}?hs=error` } });
  }
};
