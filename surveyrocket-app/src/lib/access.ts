import { and, count, desc, eq } from "drizzle-orm";
import { databaseUrl, db } from "./db";
import { clientMembers, clients, hubspotConnections, profiles, responses, surveys } from "./schema";
import { supabaseAdmin } from "./supabase-admin";

export type SessionUser = {
  id: string;
  email: string | null;
};

type Profile = typeof profiles.$inferSelect;
type Client = typeof clients.$inferSelect;
type Member = typeof clientMembers.$inferSelect;

let postgresUnavailable = false;

async function withDb<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!postgresUnavailable && db && databaseUrl()) {
    try {
      return await fn();
    } catch {
      postgresUnavailable = true;
    }
  }
  return fallback();
}

function mapProfile(row: {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  theme?: string | null;
  locale?: string | null;
  notify_reviews?: boolean | null;
  is_superadmin: boolean;
}): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url ?? null,
    theme: row.theme || "dark",
    locale: row.locale || "en",
    notifyReviews: row.notify_reviews !== false,
    isSuperadmin: row.is_superadmin,
  };
}

function mapClient(row: {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  brand: Record<string, unknown>;
  review_links: Record<string, string>;
  created_at: string;
}): Client {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    brand: row.brand || {},
    reviewLinks: row.review_links || {},
    createdAt: new Date(row.created_at),
  };
}

export async function loadProfile(userId: string) {
  return withDb(
    async () => {
      const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
      return rows[0] ?? null;
    },
    async () => {
      const { data } = await supabaseAdmin()
        .from("profiles")
        .select("id,email,full_name,avatar_url,theme,locale,notify_reviews,is_superadmin")
        .eq("id", userId)
        .maybeSingle();
      return data ? mapProfile(data) : null;
    },
  );
}

export async function clientBySlug(slug: string) {
  return withDb(
    async () => {
      const rows = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
      return rows[0] ?? null;
    },
    async () => {
      const { data } = await supabaseAdmin().from("clients").select("*").eq("slug", slug).maybeSingle();
      return data ? mapClient(data) : null;
    },
  );
}

export async function membershipFor(userId: string, clientId: string) {
  return withDb(
    async () => {
      const rows = await db
        .select()
        .from(clientMembers)
        .where(and(eq(clientMembers.userId, userId), eq(clientMembers.clientId, clientId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async () => {
      const { data } = await supabaseAdmin()
        .from("client_members")
        .select("user_id,client_id,role")
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!data) return null;
      return { userId: data.user_id, clientId: data.client_id, role: data.role } as Member;
    },
  );
}

export async function firstClientFor(userId: string) {
  return withDb(
    async () => {
      const rows = await db
        .select({ client: clients })
        .from(clientMembers)
        .innerJoin(clients, eq(clientMembers.clientId, clients.id))
        .where(eq(clientMembers.userId, userId))
        .limit(1);
      return rows[0]?.client ?? null;
    },
    async () => {
      const admin = supabaseAdmin();
      const { data: memberships } = await admin.from("client_members").select("client_id").eq("user_id", userId).limit(1);
      const clientId = memberships?.[0]?.client_id;
      if (!clientId) return null;
      const { data } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
      return data ? mapClient(data) : null;
    },
  );
}

export async function listClients() {
  return withDb(
    async () => db.select().from(clients).orderBy(desc(clients.createdAt)),
    async () => {
      const { data } = await supabaseAdmin().from("clients").select("*").order("created_at", { ascending: false });
      return (data || []).map(mapClient);
    },
  );
}

export async function createClientRecord(input: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  brand?: Record<string, unknown>;
}) {
  return withDb(
    async () => {
      const [row] = await db
        .insert(clients)
        .values({
          slug: input.slug,
          name: input.name,
          logoUrl: input.logoUrl || null,
          brand: input.brand || {},
        })
        .returning();
      return row;
    },
    async () => {
      const { data, error } = await supabaseAdmin()
        .from("clients")
        .insert({
          slug: input.slug,
          name: input.name,
          logo_url: input.logoUrl || null,
          brand: input.brand || {},
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "Could not create client");
      return mapClient(data);
    },
  );
}

export async function hubspotStatusByClient() {
  return withDb(
    async () => {
      const conns = await db.select().from(hubspotConnections);
      return new Map(conns.map((c) => [c.clientId, { status: c.status, portalId: c.portalId }]));
    },
    async () => {
      const { data } = await supabaseAdmin().from("hubspot_connections").select("client_id,status,portal_id");
      return new Map(
        (data || []).map((c) => [c.client_id as string, { status: c.status as string, portalId: (c.portal_id as string) || null }]),
      );
    },
  );
}

export async function membersForClient(clientId: string) {
  return withDb(
    async () => {
      const rows = await db
        .select({ member: clientMembers, profile: profiles })
        .from(clientMembers)
        .innerJoin(profiles, eq(clientMembers.userId, profiles.id))
        .where(eq(clientMembers.clientId, clientId));
      return rows.map((r) => ({
        userId: r.member.userId,
        role: r.member.role,
        email: r.profile.email,
        fullName: r.profile.fullName,
      }));
    },
    async () => {
      const admin = supabaseAdmin();
      const { data: memberships } = await admin
        .from("client_members")
        .select("user_id,role")
        .eq("client_id", clientId);
      const ids = (memberships || []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: people } = await admin.from("profiles").select("id,email,full_name").in("id", ids);
      const byId = new Map((people || []).map((p) => [p.id, p]));
      return (memberships || []).map((m) => {
        const profile = byId.get(m.user_id);
        return {
          userId: m.user_id as string,
          role: m.role as string,
          email: (profile?.email as string) || "",
          fullName: (profile?.full_name as string) || null,
        };
      });
    },
  );
}

function tally(ids: (string | null | undefined)[]) {
  const map = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

export type AdminClientRow = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  createdAt: Date;
  users: number;
  surveys: number;
  responses: number;
  hubspot: string;
};

export async function adminWorkspaceOverview() {
  const list = await listClients();
  const hubspot = await hubspotStatusByClient();
  const counts = await withDb(
    async () => {
      const memberRows = await db.select({ clientId: clientMembers.clientId }).from(clientMembers);
      const surveyRows = await db.select({ clientId: surveys.clientId }).from(surveys);
      const responseRows = await db.select({ clientId: responses.clientId }).from(responses);
      const people = await db.select({ id: profiles.id, isSuperadmin: profiles.isSuperadmin }).from(profiles);
      return {
        members: tally(memberRows.map((r) => r.clientId)),
        surveys: tally(surveyRows.map((r) => r.clientId)),
        responses: tally(responseRows.map((r) => r.clientId)),
        userCount: people.length,
        portalUsers: people.filter((p) => !p.isSuperadmin).length,
      };
    },
    async () => {
      const admin = supabaseAdmin();
      const [{ data: memberRows }, { data: surveyRows }, { data: responseRows }, { data: people }] = await Promise.all([
        admin.from("client_members").select("client_id"),
        admin.from("surveys").select("client_id"),
        admin.from("responses").select("client_id"),
        admin.from("profiles").select("id,is_superadmin"),
      ]);
      return {
        members: tally((memberRows || []).map((r) => r.client_id as string)),
        surveys: tally((surveyRows || []).map((r) => r.client_id as string)),
        responses: tally((responseRows || []).map((r) => r.client_id as string)),
        userCount: (people || []).length,
        portalUsers: (people || []).filter((p) => !p.is_superadmin).length,
      };
    },
  );

  const clientsRows: AdminClientRow[] = list.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    logoUrl: c.logoUrl,
    createdAt: c.createdAt,
    users: counts.members.get(c.id) || 0,
    surveys: counts.surveys.get(c.id) || 0,
    responses: counts.responses.get(c.id) || 0,
    hubspot: hubspot.get(c.id)?.status || "disconnected",
  }));

  return {
    clients: clientsRows,
    totals: {
      clients: clientsRows.length,
      users: counts.userCount,
      portalUsers: counts.portalUsers,
      surveys: clientsRows.reduce((n, c) => n + c.surveys, 0),
      responses: clientsRows.reduce((n, c) => n + c.responses, 0),
    },
  };
}

export async function listUsersWithClients() {
  return withDb(
    async () => {
      const people = await db.select().from(profiles);
      const memberships = await db
        .select({ member: clientMembers, client: clients })
        .from(clientMembers)
        .innerJoin(clients, eq(clientMembers.clientId, clients.id));
      return people.map((p) => ({
        ...p,
        clients: memberships
          .filter((m) => m.member.userId === p.id)
          .map((m) => ({ slug: m.client.slug, name: m.client.name, role: m.member.role })),
      }));
    },
    async () => {
      const admin = supabaseAdmin();
      const { data: people } = await admin.from("profiles").select("id,email,full_name,is_superadmin");
      const { data: memberships } = await admin.from("client_members").select("user_id,role,client_id");
      const { data: clientRows } = await admin.from("clients").select("id,slug,name");
      const byClient = new Map((clientRows || []).map((c) => [c.id, c]));
      return (people || []).map((p) => ({
        id: p.id as string,
        email: p.email as string,
        fullName: (p.full_name as string) || null,
        isSuperadmin: Boolean(p.is_superadmin),
        clients: (memberships || [])
          .filter((m) => m.user_id === p.id)
          .map((m) => {
            const client = byClient.get(m.client_id);
            return { slug: (client?.slug as string) || "", name: (client?.name as string) || "", role: m.role as string };
          })
          .filter((c) => c.slug),
      }));
    },
  );
}

export type ShelfSurvey = {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  cadence: string | null;
  status: string;
  questionCount: number;
  answers: number;
};

function questionCountFrom(definition: unknown) {
  const questions = (definition as { questions?: unknown[] } | null)?.questions;
  return Array.isArray(questions) ? questions.length : 0;
}

export async function surveysForClient(clientId: string): Promise<ShelfSurvey[]> {
  return withDb(
    async () => {
      const list = await db.select().from(surveys).where(eq(surveys.clientId, clientId)).orderBy(desc(surveys.updatedAt));
      const rows = await db
        .select({ surveyId: responses.surveyId, n: count() })
        .from(responses)
        .where(eq(responses.clientId, clientId))
        .groupBy(responses.surveyId);
      const byId = new Map(rows.map((r) => [r.surveyId, Number(r.n)]));
      return list.map((s) => ({
        id: s.id,
        publicId: s.publicId,
        slug: s.slug,
        name: s.name,
        cadence: s.cadence,
        status: s.status,
        questionCount: questionCountFrom(s.definition),
        answers: byId.get(s.id) || 0,
      }));
    },
    async () => {
      const admin = supabaseAdmin();
      const { data: list } = await admin.from("surveys").select("*").eq("client_id", clientId).order("updated_at", { ascending: false });
      const { data: answerRows } = await admin.from("responses").select("survey_id").eq("client_id", clientId);
      const byId = tally((answerRows || []).map((r) => r.survey_id as string));
      return (list || []).map((s) => ({
        id: s.id as string,
        publicId: s.public_id as string,
        slug: s.slug as string,
        name: s.name as string,
        cadence: (s.cadence as string) || null,
        status: s.status as string,
        questionCount: questionCountFrom(s.definition),
        answers: byId.get(s.id as string) || 0,
      }));
    },
  );
}

export async function requireClientAccess(
  user: SessionUser | null,
  isSuperadmin: boolean,
  slug: string,
) {
  if (!user) return { ok: false as const, status: 401, error: "Sign in required" };
  const client = await clientBySlug(slug);
  if (!client) return { ok: false as const, status: 404, error: "Client not found" };
  if (isSuperadmin) return { ok: true as const, client, role: "superadmin" as const };
  const member = await membershipFor(user.id, client.id);
  if (!member) return { ok: false as const, status: 403, error: "No access to this client" };
  return { ok: true as const, client, role: member.role };
}

export function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
