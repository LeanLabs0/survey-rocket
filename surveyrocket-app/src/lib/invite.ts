import { supabaseAdmin } from "./supabase-admin";
import { passwordSetupPath } from "./auth-messages";
import { siteUrl } from "./supabase";

export function passwordSetupRedirect() {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(passwordSetupPath())}`;
}

async function findUserId(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
}

async function membershipClientIds(userId: string) {
  const { data } = await supabaseAdmin().from("client_members").select("client_id").eq("user_id", userId);
  return (data || []).map((row) => row.client_id as string);
}

export async function isPasswordSet(userId: string) {
  const { data, error } = await supabaseAdmin().from("profiles").select("password_set_at").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.password_set_at);
}

async function rememberMembership(userId: string, email: string, clientId: string) {
  const admin = supabaseAdmin();
  const profile = { id: userId, email, is_superadmin: false };
  const member = { user_id: userId, client_id: clientId, role: "owner" };
  const rest = await admin.from("profiles").upsert(profile);
  if (!rest.error) {
    await admin.from("client_members").upsert(member);
    return;
  }
  const { db } = await import("./db");
  const { clientMembers, profiles } = await import("./schema");
  await db.insert(profiles).values({ id: userId, email, isSuperadmin: false }).onConflictDoNothing();
  await db
    .insert(clientMembers)
    .values({ userId, clientId, role: "owner" })
    .onConflictDoNothing();
}

function inviteMailError(message: string) {
  if (/rate limit/i.test(message)) {
    return "Too many invite emails were sent. Wait a few minutes, then resend.";
  }
  if (/after \d+ seconds/i.test(message)) {
    return "Wait a minute before sending another email to this person.";
  }
  return message;
}

/** Wipe a pending invite: auth user, profile, and every portal membership. */
export async function deletePendingInvite(userId: string) {
  const admin = supabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("password_set_at,is_superadmin")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.is_superadmin) throw new Error("A superadmin account cannot be deleted from an invite.");
  if (profile?.password_set_at) {
    throw new Error("They already have access. Remove them from the portal instead.");
  }
  await admin.from("notification_reads").delete().eq("user_id", userId);
  await admin.from("user_sessions").delete().eq("user_id", userId);
  await admin.from("user_passkeys").delete().eq("user_id", userId);
  await admin.from("client_members").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !/not (found|exist)/i.test(error.message)) throw new Error(inviteMailError(error.message));
}

async function sendFreshInvite(email: string, clientIds: string[]) {
  const admin = supabaseAdmin();
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: passwordSetupRedirect() });
  if (invited.error) throw new Error(inviteMailError(invited.error.message));
  const userId = invited.data.user?.id ?? (await findUserId(admin, email));
  if (!userId) throw new Error("Could not invite user");
  for (const id of clientIds) {
    try {
      await rememberMembership(userId, email, id);
    } catch {
      /* email still went out; membership can be repaired from admin */
    }
  }
  return { userId, email };
}

export async function resendInviteEmail(emailRaw: string, clientId: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const admin = supabaseAdmin();
  const userId = await findUserId(admin, email);
  if (!userId) throw new Error("That person does not have an invite yet.");
  if (await isPasswordSet(userId)) {
    throw new Error("They already have access. Ask them to sign in, or use Forgot password.");
  }
  const onPortal = (await membershipClientIds(userId)).includes(clientId);
  if (!onPortal) throw new Error("That person is not on this portal.");
  const keep = await membershipClientIds(userId);
  await deletePendingInvite(userId);
  return sendFreshInvite(email, keep.length ? keep : [clientId]);
}

export async function inviteUserToClient(emailRaw: string, clientId: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const admin = supabaseAdmin();
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: passwordSetupRedirect() });
  let userId = invited.data.user?.id ?? null;
  const already = invited.error && /already|registered|exists/i.test(invited.error.message || "");
  if (invited.error && !already) {
    throw new Error(inviteMailError(invited.error.message));
  }
  if (!userId) userId = await findUserId(admin, email);
  if (!userId) throw new Error("Could not invite user");

  if (already) {
    if (await isPasswordSet(userId)) {
      await rememberMembership(userId, email, clientId);
      return { userId, email };
    }
    const keep = new Set(await membershipClientIds(userId));
    keep.add(clientId);
    await deletePendingInvite(userId);
    return sendFreshInvite(email, [...keep]);
  }

  try {
    await rememberMembership(userId, email, clientId);
  } catch {
    /* email still went out; membership can be repaired from admin */
  }
  return { userId, email };
}
