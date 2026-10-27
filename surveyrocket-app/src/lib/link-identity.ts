/**
 * Identity carried on a survey link (?email=&firstname=&lastname=&company=&website=).
 *
 * Query values are decoded without treating "+" as a space. URLSearchParams would
 * turn an unencoded plus in an email into a space, and rewriting every space back
 * into "+" would turn a different address (one that really had a space) into a
 * plus-address. A space stays a space and fails validation, so the contact form shows.
 */

export const LINK_FIELDS = ["email", "firstname", "lastname", "company", "website"] as const;

const MAX_SEARCH = 16_384;
const EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export type LinkIdentity = {
  email: string;
  firstname: string | null;
  lastname: string | null;
  company: string | null;
  website: string | null;
};

export type SanitizedRespondent = {
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  company: string | null;
  website: string | null;
  name: string | null;
};

type RawParam = { status: "missing" | "malformed" | "ok"; value: string };

function decodeQueryComponent(raw: string): string | null {
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%2B"));
  } catch {
    return null;
  }
}

function readParam(search: string, name: string): RawParam {
  if (!search || search.length > MAX_SEARCH) return { status: "missing", value: "" };
  const q = search.charAt(0) === "?" ? search.slice(1) : search;
  for (const part of q.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const key = decodeQueryComponent(rawKey);
    if (key !== name) continue;
    const rawVal = eq === -1 ? "" : part.slice(eq + 1);
    const value = decodeQueryComponent(rawVal);
    if (value == null) return { status: "malformed", value: "" };
    return { status: "ok", value: value.trim() };
  }
  return { status: "missing", value: "" };
}

/** Same shape the contact form already accepts (HTML email rules, dot in the domain optional). */
export function isDeliverableEmail(email: string): boolean {
  if (!email || email.length < 3 || email.length > 254) return false;
  if (email.includes("{{") || email.includes("}}")) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at <= 0 || email.indexOf("@", at + 1) !== -1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return EMAIL.test(email);
}

/** Link skip requires a dotted domain so `user@localhost` and junk still get the form. */
export function isLinkEmail(email: string): boolean {
  if (!isDeliverableEmail(email)) return false;
  return email.slice(email.indexOf("@") + 1).includes(".");
}

function linkLabel(param: RawParam, max: number): string | null {
  if (param.status !== "ok") return null;
  const value = param.value;
  if (!value || value.length > max) return null;
  if (/[\u0000-\u001F\u007F<>]/.test(value)) return null;
  return value;
}

function blockedLinkHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.includes(":")) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** http(s) only. Bare domains get https. Credentials, private hosts, and junk are dropped. */
export function normalizeLinkWebsite(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 2000) return null;
  if (/[\u0000-\u001F\u007F<>\s]/.test(cleaned)) return null;
  let candidate = cleaned;
  if (!/^https?:\/\//i.test(candidate)) {
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (blockedLinkHost(url.hostname)) return null;
  if (url.pathname === "/" && !url.search && !url.hash) return url.origin;
  return url.toString();
}

function linkWebsite(param: RawParam): string | null {
  if (param.status !== "ok" || !param.value) return null;
  return normalizeLinkWebsite(param.value);
}

export function hasIdentityParams(search: string): boolean {
  if (!search || search.length > MAX_SEARCH) return false;
  return LINK_FIELDS.some((name) => readParam(search, name).status !== "missing");
}

export function parseLinkIdentity(search: string): LinkIdentity | null {
  if (!search || search.length > MAX_SEARCH) return null;
  const emailParam = readParam(search, "email");
  if (emailParam.status !== "ok") return null;
  const email = emailParam.value.toLowerCase();
  if (!isLinkEmail(email)) return null;
  return {
    email,
    firstname: linkLabel(readParam(search, "firstname"), 100),
    lastname: linkLabel(readParam(search, "lastname"), 100),
    company: linkLabel(readParam(search, "company"), 255),
    website: linkWebsite(readParam(search, "website")),
  };
}

/** Drop identity keys and leave every other parameter byte-for-byte, including "+" and "%2F". */
export function stripIdentityParams(search: string): string {
  if (!search || search.length > MAX_SEARCH) return "";
  const q = search.charAt(0) === "?" ? search.slice(1) : search;
  if (!q) return "";
  const kept: string[] = [];
  for (const part of q.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const key = decodeQueryComponent(rawKey);
    if (key != null && (LINK_FIELDS as readonly string[]).includes(key)) continue;
    kept.push(part);
  }
  return kept.length ? `?${kept.join("&")}` : "";
}

function textValue(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function storedWebsite(value: unknown): string | null {
  const cleaned = textValue(value, 2000);
  if (!cleaned) return null;
  if (/^(javascript|data|vbscript):/i.test(cleaned)) return null;
  return cleaned;
}

/**
 * Form and API submissions. An empty email stays anonymous and keeps the other
 * fields. A non-empty email that would not pass the contact form drops the identity
 * so answers are not stored against a forged or broken address.
 */
export function sanitizeRespondent(input: unknown): SanitizedRespondent {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const emailRaw = typeof src.email === "string" ? src.email.trim().toLowerCase() : "";
  if (emailRaw && !isDeliverableEmail(emailRaw)) {
    return { email: null, firstname: null, lastname: null, company: null, website: null, name: null };
  }
  const firstname = textValue(src.firstname, 200);
  const lastname = textValue(src.lastname, 200);
  const company = textValue(src.company, 500);
  const website = storedWebsite(src.website);
  const name = textValue(src.name, 200) || [firstname, lastname].filter(Boolean).join(" ") || null;
  return {
    email: emailRaw || null,
    firstname,
    lastname,
    company,
    website,
    name,
  };
}

export function acceptContact(input: unknown): (SanitizedRespondent & { email: string }) | null {
  const row = sanitizeRespondent(input);
  if (!row.email) return null;
  return { ...row, email: row.email };
}
