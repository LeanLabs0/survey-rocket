import { readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function connectionSettings(url) {
  const parsed = new URL(url);
  let host = parsed.hostname;
  let port = Number(parsed.port || 5432);
  let username = decodeURIComponent(parsed.username);
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct) {
    const ref = direct[1];
    host = "aws-0-us-east-1.pooler.supabase.com";
    port = 6543;
    if (!username.includes(".")) username = `${username}.${ref}`;
  }
  return {
    host,
    port,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
    username,
    password: decodeURIComponent(parsed.password),
    ssl: "require",
    prepare: false,
    max: 1,
  };
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-file.mjs drizzle/0004_notification_dismiss.sql");
  process.exit(1);
}

const env = loadEnv(new URL("../.env", import.meta.url));
const url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

const sql = postgres(url, connectionSettings(url));
const text = readFileSync(new URL("../" + file.replace(/^surveyrocket-app\//, ""), import.meta.url), "utf8");
console.log(`Applying ${file} …`);
await sql.unsafe(text);
await sql.end();
console.log("Done");
