import { eq } from "drizzle-orm";
import { db } from "../db";
import { hubspotConnections } from "../schema";
import { decrypt, encrypt } from "../crypto";
import { refreshAccessToken } from "./oauth";

export async function getConnection(clientId: string) {
  const rows = await db
    .select()
    .from(hubspotConnections)
    .where(eq(hubspotConnections.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveAccessToken(clientId: string) {
  const conn = await getConnection(clientId);
  if (!conn?.refreshTokenEnc) return null;
  const refresh = decrypt(conn.refreshTokenEnc);
  if (!refresh) return null;
  if (conn.accessTokenEnc && conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000) {
    return { token: decrypt(conn.accessTokenEnc), conn };
  }
  const tokens = await refreshAccessToken(refresh);
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 1800) * 1000);
  await db
    .update(hubspotConnections)
    .set({
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : conn.refreshTokenEnc,
      expiresAt,
    })
    .where(eq(hubspotConnections.clientId, clientId));
  return { token: tokens.access_token, conn };
}

export function publicConnection(conn: typeof hubspotConnections.$inferSelect | null) {
  if (!conn) return { connected: false, status: "disconnected" };
  return {
    connected: conn.status === "connected",
    status: conn.status,
    portalId: conn.portalId,
    portalName: conn.portalName,
    connectedAt: conn.connectedAt,
    surveyObjectTypeId: conn.surveyObjectTypeId,
  };
}
