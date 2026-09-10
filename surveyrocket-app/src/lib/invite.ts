import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";
import { passwordSetupPath } from "./auth-messages";
import { siteUrl, supabasePublishableKey, supabaseUrl } from "./supabase";

export function passwordSetupRedirect() {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(passwordSetupPath())}`;
}

async function findUserId(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
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

async function sendPasswordSetupEmail(email: string, strict = false) {
  const mailer = createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await mailer.auth.resetPasswordForEmail(email, { redirectTo: passwordSetupRedirect() });
  if (error) {
    if (!strict && /after \d+ seconds/i.test(error.message)) return;
    throw new Error(inviteMailError(error.message));
  }
}

export async function resendInviteEmail(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  await sendPasswordSetupEmail(email, true);
  return { email };
}

export async function inviteUserToClient(emailRaw: string, clientId: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const admin = supabaseAdmin();
  const redirectTo = passwordSetupRedirect();
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  let userId = invited.data.user?.id ?? null;
  const already = invited.error && /already|registered|exists/i.test(invited.error.message || "");
  if (invited.error && !already) {
    throw new Error(inviteMailError(invited.error.message));
  }
  if (!userId) userId = await findUserId(admin, email);
  if (!userId) throw new Error("Could not invite user");

  if (already || !invited.data.user) {
    await sendPasswordSetupEmail(email);
  }

  try {
    await rememberMembership(userId, email, clientId);
  } catch {
    /* email still went out; membership can be repaired from admin */
  }
  return { userId, email };
}
