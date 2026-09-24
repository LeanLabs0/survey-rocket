import type { APIRoute } from "astro";
import { jsonError, jsonOk, listUsersWithClients } from "../../../lib/access";
import { deletePendingInvite, inviteSuperadmin, isPasswordSet, resendSuperadminInvite } from "../../../lib/invite";

export const GET: APIRoute = async () => {
  const users = await listUsersWithClients();
  return jsonOk({ users });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.isSuperadmin) return jsonError(403, "Superadmin only");
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim();
  if (!email) return jsonError(400, "email required");
  try {
    if (body.resend) {
      await resendSuperadminInvite(email);
    } else {
      await inviteSuperadmin(email);
    }
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not invite that superadmin");
  }
  return jsonOk({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!locals.isSuperadmin) return jsonError(403, "Superadmin only");
  const body = await request.json().catch(() => null);
  const userId = String(body?.userId || "");
  if (!userId) return jsonError(400, "userId required");
  if (userId === locals.user!.id) return jsonError(400, "You cannot remove yourself.");
  try {
    if (await isPasswordSet(userId)) {
      return jsonError(400, "They already have access. A signed-in superadmin cannot be removed from an invite.");
    }
    await deletePendingInvite(userId);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "Could not remove invite");
  }
  return jsonOk({ ok: true });
};
