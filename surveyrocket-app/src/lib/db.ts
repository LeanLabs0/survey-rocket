import dns from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { envVar } from "./env";
import * as schema from "./schema";

dns.setDefaultResultOrder("ipv4first");

export function databaseUrl() {
  return envVar("DATABASE_URL");
}

/** This machine cannot resolve db.<ref>.supabase.co; the pooler host can. */
export function connectionSettings(url: string) {
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
    ssl: "require" as const,
    prepare: false,
    max: 8,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 8,
  };
}

function createDb(url: string) {
  return drizzle(postgres(connectionSettings(url)), { schema });
}

const url = databaseUrl();
export const db = url ? createDb(url) : (null as unknown as ReturnType<typeof createDb>);
export { schema };
