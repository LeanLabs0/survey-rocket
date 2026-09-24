import { passwordSetupPath } from "./auth-messages";

const SETUP_TYPES = new Set(["invite", "recovery", "signup"]);
const HANDOFF_PATH = [/^\/$/, /^\/login\/?$/, /^\/app(?:\/|$)/, /^\/admin(?:\/|$)/, /^\/auth\/set-password\/?$/];

export function isSetupAuthType(type: string | null | undefined) {
  return SETUP_TYPES.has(type || "");
}

export function hasAuthHandoffParams(url: URL) {
  return Boolean(url.searchParams.get("code") || url.searchParams.get("token_hash") || url.searchParams.get("token"));
}

/** Query tokens on login / app / / — not HubSpot or other /api/oauth codes. */
export function shouldHandoffAuth(url: URL) {
  if (!hasAuthHandoffParams(url)) return false;
  if (url.pathname.startsWith("/api/") || url.pathname === "/auth/callback") return false;
  return HANDOFF_PATH.some((re) => re.test(url.pathname));
}

export function authCallbackLocation(url: URL) {
  const dest = new URL("/auth/callback", url.origin);
  url.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
  const type = url.searchParams.get("type");
  if (!dest.searchParams.get("next") || isSetupAuthType(type)) {
    dest.searchParams.set("next", passwordSetupPath());
  }
  return dest.pathname + dest.search;
}

/** Client handoff: hash tokens are never visible to the server. */
export function authHandoffScript(fallbackPath?: string) {
  const fallback = fallbackPath ? JSON.stringify(fallbackPath) : "null";
  return `(function(){var h=location.hash||"";var s=location.search||"";var hp=new URLSearchParams(h.replace(/^#/,""));var sp=new URLSearchParams(s);if(hp.get("access_token")||hp.get("error")||hp.get("error_description")||sp.get("code")||sp.get("token_hash")||sp.get("token")){var dest=new URL("/auth/callback",location.origin);sp.forEach(function(v,k){dest.searchParams.set(k,v)});if(!dest.searchParams.get("next"))dest.searchParams.set("next","/auth/set-password");location.replace(dest.pathname+dest.search+h);return}var fallback=${fallback};if(fallback)location.replace(fallback)})();`;
}

export function authHandoffHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Survey Rocket</title><script>${authHandoffScript("/app")}</script></head><body></body></html>`;
}

/** surveyrocket.ai → beta must be client-side so invite #access_token is not dropped. */
export function crossHostHandoffHtml(appOrigin: string) {
  const app = JSON.stringify(appOrigin.replace(/\/$/, ""));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Survey Rocket</title><script>(function(){var app=${app};var h=location.hash||"";var s=location.search||"";var hp=new URLSearchParams(h.replace(/^#/,""));var sp=new URLSearchParams(s);if(hp.get("access_token")||hp.get("error")||hp.get("error_description")||sp.get("code")||sp.get("token_hash")||sp.get("token")){var dest=new URL("/auth/callback",app);sp.forEach(function(v,k){dest.searchParams.set(k,v)});if(!dest.searchParams.get("next"))dest.searchParams.set("next","/auth/set-password");location.replace(app+dest.pathname+dest.search+h);return}location.replace(app+location.pathname+s)})();</script></head><body></body></html>`;
}
