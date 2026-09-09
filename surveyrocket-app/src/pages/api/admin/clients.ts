import type { APIRoute } from "astro";
import { createClientRecord, hubspotStatusByClient, jsonError, jsonOk, listClients } from "../../../lib/access";
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
      brand: body.brand || {},
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
