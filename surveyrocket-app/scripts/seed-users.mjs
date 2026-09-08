import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* no .env file */
  }
}
loadEnv();

const url = process.env.SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE || "";
const password = process.env.DEV_LOGIN_PASSWORD || "";

if (!url || !secret) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error("Set DEV_LOGIN_PASSWORD in .env (at least 8 characters).");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const people = [
  { email: "edward+admin@lean-labs.com", fullName: "Edward (admin)", superadmin: true, clientRole: null },
  { email: "edward@lean-labs.com", fullName: "Edward", superadmin: false, clientRole: "owner" },
];

async function findUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function upsertUser(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { is_superadmin: email === "edward+admin@lean-labs.com" },
  });
  if (!error && data.user?.id) return data.user.id;
  const existingId = await findUserId(email);
  if (!existingId) throw new Error(error?.message || `Could not create ${email}`);
  const updated = await admin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { is_superadmin: email === "edward+admin@lean-labs.com" },
  });
  if (updated.error) throw updated.error;
  return existingId;
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path} ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

for (const person of people) {
  const userId = await upsertUser(person.email, person.fullName);
  console.log(`Auth user ${person.email} (${userId})`);
}

try {
  const clientRows = await rest("clients?slug=eq.lean-labs&select=id,slug,name");
  const client = Array.isArray(clientRows) ? clientRows[0] : null;
  if (!client) throw new Error("lean-labs client is missing. Run drizzle/0001_seed.sql first.");
  for (const person of people) {
    const userId = await findUserId(person.email);
    await rest("profiles?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: userId,
        email: person.email,
        full_name: person.fullName,
        is_superadmin: person.superadmin,
      },
    });
    if (person.clientRole) {
      await rest("client_members?on_conflict=user_id,client_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { user_id: userId, client_id: client.id, role: person.clientRole },
      });
    }
    console.log(`${person.email} → ${person.superadmin ? "superadmin" : `lean-labs ${person.clientRole}`}`);
  }
} catch (err) {
  if (err.status === 403 || /42501|permission denied/i.test(err.message || "")) {
    console.log("Auth users are ready. Table grants are still missing — paste drizzle/0002_test_users.sql in the SQL editor, then you can sign in.");
    process.exit(0);
  }
  throw err;
}

console.log("Test users are ready. Sign in at /login with email + DEV_LOGIN_PASSWORD.");
