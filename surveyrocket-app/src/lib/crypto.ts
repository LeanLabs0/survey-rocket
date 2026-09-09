import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { envVar } from "./env";

export function hashToken(value: string | null | undefined) {
  if (!value) return "";
  return createHash("sha256").update(value).digest("hex");
}

export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  const salt = envVar("IP_SALT") || "dev-ip-salt";
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

function encryptionKey() {
  const raw = envVar("HUBSPOT_TOKEN_ENCRYPTION_KEY") || "dev-only-insecure-key";
  return createHash("sha256").update(raw).digest();
}

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(payload: string | null | undefined) {
  if (!payload) return "";
  const [ivB64, tagB64, dataB64] = String(payload).split(".");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function clientIp(request: Request) {
  const h = request.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("x-vercel-forwarded-for") ||
    ""
  );
}

export function clientCountry(request: Request) {
  return request.headers.get("x-vercel-ip-country") || null;
}
