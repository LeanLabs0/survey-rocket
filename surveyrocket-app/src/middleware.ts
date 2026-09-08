import { defineMiddleware } from "astro:middleware";
import { sessionFromCookies, supabaseFromCookies } from "./lib/supabase";
import { loadProfile } from "./lib/access";
import { sessionIsRevoked } from "./lib/sessions";

const PROTECTED = [/^\/app(?:\/|$)/, /^\/admin(?:\/|$)/, /^\/api\/app(?:\/|$)/, /^\/api\/admin(?:\/|$)/, /^\/api\/hubspot\/oauth\/start/];

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, url, locals, request } = context;
  locals.user = null;
  locals.profile = null;
  locals.isSuperadmin = false;

  try {
    const user = sessionFromCookies(cookies)?.user ?? null;
    if (user) {
      const revoked = await sessionIsRevoked(cookies).catch(() => false);
      if (revoked) {
        try {
          await supabaseFromCookies(cookies, request).auth.signOut();
        } catch {
          /* ignore */
        }
      } else {
        locals.user = { id: user.id, email: user.email ?? null };
        const profile = await loadProfile(user.id).catch(() => null);
        const meta = user.app_metadata as { is_superadmin?: boolean; sr_role?: string } | undefined;
        const fromJwt = meta?.is_superadmin === true || meta?.sr_role === "superadmin";
        if (profile) {
          locals.profile = {
            id: profile.id,
            email: profile.email,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            theme: profile.theme,
            locale: profile.locale,
            notifyReviews: profile.notifyReviews,
            isSuperadmin: profile.isSuperadmin,
          };
        }
        locals.isSuperadmin = Boolean(profile?.isSuperadmin || fromJwt);
      }
    }
  } catch {
    // env not configured yet
  }

  if (PROTECTED.some((re) => re.test(url.pathname))) {
    if (!locals.user) {
      if (url.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Sign in required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const nextUrl = encodeURIComponent(url.pathname + url.search);
      return context.redirect(`/login?next=${nextUrl}`);
    }
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")) {
      if (!locals.isSuperadmin) {
        if (url.pathname.startsWith("/api/")) {
          return new Response(JSON.stringify({ error: "Superadmin only" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        return context.redirect("/app");
      }
    }
  }

  return next();
});
