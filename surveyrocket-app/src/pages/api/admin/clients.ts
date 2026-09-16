import type { APIRoute } from "astro";
import { createClientRecord, hubspotStatusByClient, jsonError, jsonOk, listClients, updateClientBrand } from "../../../lib/access";
import { sanitizeClientBrand } from "../../../lib/brand";
import { inviteUserToClient } from "../../../lib/invite";
import { slugify } from "../../../lib/ids";

export const GET: APIRoute = async () => {
  const list = await listClients();
  const byClient = await hubspotStatusByClient();
  return jsonOk({
    clients: list.map((c) => ({
      ...c,
      hubspot: byClient.get(c.id)?.status || "disconnected",
      portalId: byClient.get(c.id)?.portalId || null,
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.name) return jsonError(400, "name required");
  const slug = slugify(body.slug || body.name);
  let row;
  try {
    row = await createClientRecord({
      slug,
      name: body.name,
      logoUrl: null,
      brand: sanitizeClientBrand(body.brand || {}),
    });
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not create client");
  }
  if (body.inviteEmail) {
    try {
      await inviteUserToClient(String(body.inviteEmail), row.id);
    } catch {
      /* client still created; admin can invite again */
    }
  }
  return jsonOk({ client: row }, 201);
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  if (!locals.isSuperadmin) return jsonError(403, "Superadmin only");
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug || "").trim();
  if (!slug) return jsonError(400, "slug required");
  if (!body || !("brand" in body)) return jsonError(400, "brand required");
  const brand = sanitizeClientBrand(body.brand);
  let row;
  try {
    row = await updateClientBrand(slug, brand);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not save theme");
  }
  if (!row) return jsonError(404, "Client not found");
  return jsonOk({ client: row });
};
