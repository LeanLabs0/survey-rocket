/** Marketing site. App, auth, and surveys stay on beta. */
export const MARKETING_ORIGIN = "https://surveyrocket.ai";
export const APP_ORIGIN = "https://beta.surveyrocket.ai";

const MARKETING_HOSTS = new Set(["surveyrocket.ai", "www.surveyrocket.ai"]);

function isMarketingAsset(pathname: string) {
  if (pathname === "/" || pathname === "") return true;
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  );
}

/** Localhost and *.vercel.app keep serving everything. Production hosts split. */
export function hostSplitRedirect(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (MARKETING_HOSTS.has(host)) {
    if (!isMarketingAsset(url.pathname)) {
      return `${APP_ORIGIN}${url.pathname}${url.search}`;
    }
    if (host === "www.surveyrocket.ai") {
      return `${MARKETING_ORIGIN}${url.pathname}${url.search}`;
    }
    return null;
  }
  if (host === "beta.surveyrocket.ai" && (url.pathname === "/" || url.pathname === "")) {
    return `${APP_ORIGIN}/login`;
  }
  return null;
}

/** Demo / login links on the landing page. Empty on localhost so relative /demo works. */
export function appOrigin() {
  if (import.meta.env.DEV) return "";
  return String(import.meta.env.PUBLIC_APP_URL || APP_ORIGIN).replace(/\/$/, "");
}
