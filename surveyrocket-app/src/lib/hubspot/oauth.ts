import { envVar } from "../env";

/** Must match hubspot-app/src/app/app-hsmeta.json requiredScopes. */
export const HUBSPOT_REQUIRED_SCOPES = [
  "oauth",
  "forms",
  "crm.lists.read",
  "crm.lists.write",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
];

const HUBSPOT_SCOPES = HUBSPOT_REQUIRED_SCOPES.join(" ");

const CONTACT_READ = "crm.objects.contacts.read";
const CONTACT_WRITE = "crm.objects.contacts.write";

function trimEnv(name: string) {
  return envVar(name);
}

function isLocalhostUri(uri: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(uri);
}

export function grantedScopeSet(raw: string | string[] | null | undefined) {
  const text = Array.isArray(raw) ? raw.join(" ") : raw || "";
  return new Set(text.split(/[\s,]+/).filter(Boolean));
}

export function missingHubSpotScopes(raw: string | string[] | null | undefined) {
  const have = grantedScopeSet(raw);
  return HUBSPOT_REQUIRED_SCOPES.filter((scope) => !have.has(scope));
}

export function missingContactScopes(raw: string | string[] | null | undefined) {
  const have = grantedScopeSet(raw);
  return [CONTACT_READ, CONTACT_WRITE].filter((scope) => !have.has(scope));
}

export function hasContactWrite(raw: string | string[] | null | undefined) {
  return grantedScopeSet(raw).has(CONTACT_WRITE);
}

export function hasContactRead(raw: string | string[] | null | undefined) {
  return grantedScopeSet(raw).has(CONTACT_READ);
}

export function hubspotRedirectUri() {
  const explicit = trimEnv("HUBSPOT_APP_REDIRECT_URI");
  if (process.env.VERCEL) {
    if (explicit && !isLocalhostUri(explicit)) return explicit;
    const host = (trimEnv("PUBLIC_SITE_URL") || "https://beta.surveyrocket.ai").replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/api/hubspot/oauth/callback`;
  }
  if (explicit && isLocalhostUri(explicit)) return explicit;
  return "http://localhost:4321/api/hubspot/oauth/callback";
}

export function isHubSpotConfigured() {
  return Boolean(trimEnv("HUBSPOT_APP_CLIENT_ID") && trimEnv("HUBSPOT_APP_CLIENT_SECRET"));
}

export function buildInstallUrl(state: string) {
  const clientId = trimEnv("HUBSPOT_APP_CLIENT_ID");
  const redirectUri = hubspotRedirectUri();
  if (!clientId) throw new Error("HUBSPOT_APP_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: HUBSPOT_REQUIRED_SCOPES.join(" "),
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams) {
  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || `Token exchange failed (${res.status})`);
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function exchangeCodeForTokens(code: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: trimEnv("HUBSPOT_APP_CLIENT_ID"),
      client_secret: trimEnv("HUBSPOT_APP_CLIENT_SECRET"),
      redirect_uri: hubspotRedirectUri(),
      code,
    }),
  );
}

export async function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: trimEnv("HUBSPOT_APP_CLIENT_ID"),
      client_secret: trimEnv("HUBSPOT_APP_CLIENT_SECRET"),
      refresh_token: refreshToken,
    }),
  );
}

export async function getTokenInfo(accessToken: string) {
  const res = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `Token info failed (${res.status})`);
  return payload as { hub_id?: number; user?: string; scopes?: string[]; hub_domain?: string };
}

export { HUBSPOT_SCOPES };
