import type { APIRoute } from "astro";
import { jsonError } from "../../../../lib/access";
import { clientBySlug } from "../../../../lib/access";
import { membershipFor } from "../../../../lib/access";
import { buildInstallUrl, isHubSpotConfigured } from "../../../../lib/hubspot/oauth";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const slug = url.searchParams.get("client") || "";
  const client = await clientBySlug(slug);
  if (!client) return jsonError(404, "Client not found");
  if (!locals.isSuperadmin) {
    const member = await membershipFor(locals.user.id, client.id);
    if (!member) return jsonError(403, "No access");
  }
  if (!isHubSpotConfigured()) {
    const back = slug ? `/app/${encodeURIComponent(slug)}/settings?hs=error` : "/app";
    return new Response(null, { status: 302, headers: { Location: back } });
  }
  const state = Buffer.from(JSON.stringify({ clientId: client.id, slug, uid: locals.user.id })).toString("base64url");
  return new Response(null, { status: 302, headers: { Location: buildInstallUrl(state) } });
};
