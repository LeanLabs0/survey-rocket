import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let fileEnv: Record<string, string> | null = null;

function loadDotenvFile() {
  if (fileEnv) return fileEnv;
  fileEnv = {};
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return fileEnv;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    fileEnv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fileEnv;
}

function isPlaceholder(name: string, value: string) {
  if (!value) return true;
  if (/example\.supabase\.co/i.test(value)) return true;
  if (name === "DATABASE_URL" && /user:pass@localhost/i.test(value)) return true;
  return false;
}

/** Project `.env` wins over leftover machine-wide placeholders. */
export function envVar(name: string) {
  const fromFile = loadDotenvFile()[name] || "";
  if (fromFile && !isPlaceholder(name, fromFile)) return fromFile;
  const fromProcess = String(process.env[name] || "").trim();
  if (fromProcess && !isPlaceholder(name, fromProcess)) return fromProcess;
  const fromMeta = String((import.meta.env as Record<string, string | undefined>)[name] || "").trim();
  if (fromMeta && !isPlaceholder(name, fromMeta)) return fromMeta;
  return fromFile || fromProcess || fromMeta;
}
