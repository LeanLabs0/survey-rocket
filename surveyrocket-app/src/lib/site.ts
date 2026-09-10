/** Marketing site. App, auth, and surveys stay on beta. */
export const MARKETING_ORIGIN = "https://surveyrocket.ai";
export const APP_ORIGIN = "https://beta.surveyrocket.ai";

const MARKETING_HOSTS = new Set(["surveyrocket.ai", "www.surveyrocket.ai"]);

const APP_PATH = /^\/(app|admin|login|logout|demo|auth|s|api)(?:\/|$)/;

function isMarketingAsset(pathname: string) {
  if (pathname === "/" || pathname === "") return true;
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/robots.txt"
  );
}

export function isAppPath(pathname: string) {
  return APP_PATH.test(pathname);
}

export function isMarketingHost(request: Request, url: URL) {
  return MARKETING_HOSTS.has(requestHost(request, url));
}

/** Marketing 404 on surveyrocket.ai. Local preview: ?site=marketing or ?view=marketing. */
export function isMarketingNotFound(request: Request, url: URL) {
  const preview = url.searchParams.get("site") || url.searchParams.get("view");
  if (preview === "marketing") return true;
  if (preview === "app") return false;
  return isMarketingHost(request, url);
}

/** Vercel custom domains put the public host on x-forwarded-host, not url.hostname. */
export function requestHost(request: Request, url: URL) {
  const raw =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.hostname;
  return raw.split(",")[0].trim().split(":")[0].toLowerCase();
}

/** Localhost and *.vercel.app keep serving everything. Production hosts split.
 *  Only redirect GET/HEAD. 308 on POST would replay the body to beta with
 *  Origin still on surveyrocket.ai, and Astro rejects that as CSRF. */
export function hostSplitRedirect(url: URL, request: Request): string | null {
  const host = requestHost(request, url);
  const method = request.method.toUpperCase();
  const safeRedirect = method === "GET" || method === "HEAD";
  if (MARKETING_HOSTS.has(host)) {
    if (isAppPath(url.pathname)) {
      if (!safeRedirect) return `${APP_ORIGIN}/login`;
      return `${APP_ORIGIN}${url.pathname}${url.search}`;
    }
    if (host === "www.surveyrocket.ai" && isMarketingAsset(url.pathname)) {
      return `${MARKETING_ORIGIN}${url.pathname}${url.search}`;
    }
    return null;
  }
  if (host === "beta.surveyrocket.ai" && (url.pathname === "/" || url.pathname === "")) {
    return `${APP_ORIGIN}/app`;
  }
  return null;
}

/** Demo / login links on the landing page. Empty on localhost so relative /demo works. */
export function appOrigin() {
  if (import.meta.env.DEV) return "";
  return String(import.meta.env.PUBLIC_APP_URL || APP_ORIGIN).replace(/\/$/, "");
}

/** Marketing home. Empty on localhost so relative / works. */
export function marketingOrigin() {
  if (import.meta.env.DEV) return "";
  return MARKETING_ORIGIN;
}
