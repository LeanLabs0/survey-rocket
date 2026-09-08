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

const env = loadEnv(new URL("../.env", import.meta.url));
const url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

const host = new URL(url).hostname;
const port = new URL(url).port || "5432";
console.log(`Connecting to ${host}:${port} …`);

const sql = postgres(url, { prepare: false, max: 1, ssl: "require" });
const text = readFileSync(new URL("../drizzle/0000_init.sql", import.meta.url), "utf8");
await sql.unsafe(text);
await sql.end();
console.log("Applied drizzle/0000_init.sql");
