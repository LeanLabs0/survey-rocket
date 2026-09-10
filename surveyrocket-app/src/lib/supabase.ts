import {
  createChunks,
  createServerClient,
  parseCookieHeader,
  stringFromBase64URL,
  stringToBase64URL,
  type CookieOptions,
} from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { createClient, type Session } from "@supabase/supabase-js";
import { envVar } from "./env";

export function supabaseUrl() {
  return envVar("SUPABASE_URL");
}

/** Publishable key (sb_publishable_…) or legacy anon JWT. */
export function supabasePublishableKey() {
  return envVar("SUPABASE_PUBLISHABLE_KEY") || envVar("SUPABASE_ANON_KEY");
}

export function supabaseFromCookies(cookies: AstroCookies, request: Request) {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) are required");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        toSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}

export function siteUrl() {
  return (envVar("PUBLIC_SITE_URL") || "http://localhost:4321").replace(/\/$/, "");
}

export function safeNextPath(next: string | null | undefined, fallback = "/app") {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return fallback;
  return next;
}

export function parseOtpWaitSeconds(message: string) {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : null;
}

export function plainAuthClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signInWithPasswordDirect(email: string, password: string): Promise<Session> {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        expires_at?: number;
        token_type?: string;
        user?: Session["user"];
        error_description?: string;
        msg?: string;
        message?: string;
      }
    | null;
  if (!res.ok || !body?.access_token || !body.refresh_token || !body.user) {
    throw new Error(body?.error_description || body?.msg || body?.message || `Sign-in failed (${res.status})`);
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in ?? 3600,
    expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
    token_type: body.token_type || "bearer",
    user: body.user,
  };
}

function authCookieKey() {
  return `sb-${new URL(supabaseUrl()).hostname.split(".")[0]}-auth-token`;
}

function sessionCookieOpts() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    secure: !import.meta.env.DEV,
    maxAge: 400 * 24 * 60 * 60,
  };
}

/** Write the auth session the same way @supabase/ssr does, without a follow-up Auth fetch. */
export function persistSessionCookies(cookies: AstroCookies, session: Session) {
  const key = authCookieKey();
  const encoded = "base64-" + stringToBase64URL(JSON.stringify(session));
  const chunks = createChunks(key, encoded);
  const written = new Set(chunks.map((chunk) => chunk.name));
  const opts = sessionCookieOpts();
  for (const chunk of chunks) {
    cookies.set(chunk.name, chunk.value, opts);
  }
  if (!written.has(key) && cookies.get(key)?.value) cookies.delete(key, { path: "/" });
  for (let i = 0; i < 8; i += 1) {
    const name = `${key}.${i}`;
    if (!written.has(name) && cookies.get(name)?.value) cookies.delete(name, { path: "/" });
  }
}

export function sessionFromCookies(cookies: AstroCookies): Session | null {
  const key = authCookieKey();
  let raw = cookies.get(key)?.value ?? "";
  if (!raw) {
    const parts: string[] = [];
    for (let i = 0; ; i += 1) {
      const chunk = cookies.get(`${key}.${i}`)?.value;
      if (!chunk) break;
      parts.push(chunk);
    }
    raw = parts.join("");
  }
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? stringFromBase64URL(raw.slice("base64-".length)) : raw;
    return JSON.parse(json) as Session;
  } catch {
    return null;
  }
}

/** Keep a stored browser session alive by refreshing the access token before it expires. */
export async function restoreSession(cookies: AstroCookies): Promise<Session | null> {
  const session = sessionFromCookies(cookies);
  if (!session?.user || !session.access_token) return null;
  const expiresAt = Number(session.expires_at || 0);
  const stillFresh = expiresAt > Math.floor(Date.now() / 1000) + 60;
  if (stillFresh || !session.refresh_token) return session;
  try {
    const { data, error } = await plainAuthClient().auth.refreshSession({ refresh_token: session.refresh_token });
    if (error || !data.session) return session;
    persistSessionCookies(cookies, data.session);
    return data.session;
  } catch {
    return session;
  }
}

