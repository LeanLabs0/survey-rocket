import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk, requireClientAccess } from "../../../lib/access";
import { db } from "../../../lib/db";
import { clients, profiles } from "../../../lib/schema";
import { uploadPublicImage } from "../../../lib/storage";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return jsonError(401, "Sign in required");
  const form = await request.formData();
  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return jsonError(400, "Choose a file.");
  try {
    if (kind === "avatar") {
      const url = await uploadPublicImage(`avatars/${locals.user.id}`, file);
      await db.update(profiles).set({ avatarUrl: url }).where(eq(profiles.id, locals.user.id));
      return jsonOk({ url, kind });
    }
    if (kind === "logo") {
      const slug = String(form.get("client") || "");
      const access = await requireClientAccess(locals.user, locals.isSuperadmin, slug);
      if (!access.ok) return jsonError(access.status, access.error);
      const url = await uploadPublicImage(`logos/${access.client.id}`, file);
      await db.update(clients).set({ logoUrl: url }).where(eq(clients.id, access.client.id));
      return jsonOk({ url, kind });
    }
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not upload that file.");
  }
  return jsonError(400, "Unknown upload kind");
};
