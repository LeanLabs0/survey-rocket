import { and, desc, eq, isNull } from "drizzle-orm";
import type { AstroCookies } from "astro";
import { db } from "./db";
import { userSessions } from "./schema";
import { clientIp, hashToken } from "./crypto";
import { sessionFromCookies } from "./supabase";

export function currentTokenHash(cookies: AstroCookies) {
  const session = sessionFromCookies(cookies);
  return hashToken(session?.refresh_token || session?.access_token || "");
}

export async function touchSession(userId: string, cookies: AstroCookies, request: Request) {
  const tokenHash = currentTokenHash(cookies);
  if (!tokenHash || !db) return null;
  const [existing] = await db.select().from(userSessions).where(eq(userSessions.tokenHash, tokenHash)).limit(1);
  if (existing?.revokedAt) return existing;
  if (existing) {
    const [row] = await db
      .update(userSessions)
      .set({ lastSeenAt: new Date(), userAgent: request.headers.get("user-agent"), ip: clientIp(request) || existing.ip })
      .where(eq(userSessions.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(userSessions)
    .values({
      userId,
      tokenHash,
      userAgent: request.headers.get("user-agent"),
      ip: clientIp(request) || null,
    })
    .returning();
  return row;
}

export async function sessionIsRevoked(cookies: AstroCookies) {
  const tokenHash = currentTokenHash(cookies);
  if (!tokenHash || !db) return false;
  const [row] = await db.select().from(userSessions).where(eq(userSessions.tokenHash, tokenHash)).limit(1);
  return Boolean(row?.revokedAt);
}

export async function listSessions(userId: string, currentHash: string) {
  const rows = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastSeenAt));
  return rows.map((r) => ({
    id: r.id,
    current: r.tokenHash === currentHash,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
  }));
}

export async function revokeSession(userId: string, sessionId: string) {
  const [row] = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)))
    .returning();
  return row;
}
