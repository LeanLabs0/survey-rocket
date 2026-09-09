import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { respondents, surveys } from "../schema";
import { resolveAccessToken } from "./tokens";

const OBJECT_CONTACTS = "0-1";

type HsJson = Record<string, unknown>;

async function hs(
  token: string,
  path: string,
  { method = "GET", body, allowStatuses = [] as number[] }: { method?: string; body?: unknown; allowStatuses?: number[] } = {},
) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && allowStatuses.includes(res.status)) {
    return { ok: false, status: res.status, data: null as HsJson | null };
  }
  const text = await res.text();
  let data: HsJson | null = null;
  try {
    data = text ? (JSON.parse(text) as HsJson) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data?.message as string) || (data?.error as string) || text || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return { ok: true, status: res.status, data };
}

function clipName(surveyName: string) {
  const trimmed = surveyName.trim() || "Untitled";
  return trimmed.length > 72 ? trimmed.slice(0, 72).trim() : trimmed;
}

export function surveyListNames(surveyName: string) {
  const name = clipName(surveyName);
  return {
    signedIn: `[LL] SurveyRocket - ${name}_signed_in`,
    completed: `[LL] SurveyRocket - ${name}_completed`,
  };
}

async function findListId(token: string, name: string) {
  const byName = await hs(token, `/crm/v3/lists/object-type-id/${OBJECT_CONTACTS}/name/${encodeURIComponent(name)}`, {
    allowStatuses: [404],
  });
  const named = ((byName.data?.list as { listId?: string } | undefined) || (byName.data as { listId?: string } | null))?.listId;
  if (named) return String(named);
  try {
    const page = await hs(token, "/crm/v3/lists/search", {
      method: "POST",
      body: { query: name, count: 100, processingTypes: ["MANUAL"], objectTypeId: OBJECT_CONTACTS },
    });
    const lists = (page.data?.lists as { listId?: string; name?: string }[]) || [];
    const match = lists.find((l) => String(l.name || "").trim() === name);
    return match?.listId ? String(match.listId) : null;
  } catch {
    return null;
  }
}

async function createOrFindList(token: string, name: string) {
  const existing = await findListId(token, name);
  if (existing) return existing;
  try {
    const created = await hs(token, "/crm/v3/lists", {
      method: "POST",
      body: { name, objectTypeId: OBJECT_CONTACTS, processingType: "MANUAL" },
    });
    const list = created.data?.list as { listId?: string } | undefined;
    const id = list?.listId || (created.data?.listId as string | undefined);
    if (!id) throw new Error("HubSpot did not return a list id");
    return String(id);
  } catch (err) {
    const again = await findListId(token, name);
    if (again) return again;
    throw err;
  }
}

export async function ensureSurveyLists(survey: typeof surveys.$inferSelect) {
  if (survey.deletedAt) return survey;
  const access = await resolveAccessToken(survey.clientId);
  if (!access) return survey;
  const names = surveyListNames(survey.name);
  let signedIn = survey.hsSignedInListId;
  let completed = survey.hsCompletedListId;
  if (!signedIn) signedIn = await createOrFindList(access.token, names.signedIn);
  if (!completed) completed = await createOrFindList(access.token, names.completed);
  if (signedIn === survey.hsSignedInListId && completed === survey.hsCompletedListId) return survey;
  const [row] = await db
    .update(surveys)
    .set({ hsSignedInListId: signedIn, hsCompletedListId: completed })
    .where(eq(surveys.id, survey.id))
    .returning();
  return row || { ...survey, hsSignedInListId: signedIn, hsCompletedListId: completed };
}

export async function ensureClientSurveyLists(clientId: string) {
  const list = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.clientId, clientId), isNull(surveys.deletedAt)));
  const missing = list.filter((sv) => !sv.hsSignedInListId || !sv.hsCompletedListId);
  for (const sv of missing) {
    try {
      await ensureSurveyLists(sv);
    } catch (err) {
      console.error("hubspot lists", sv.id, err);
    }
  }
}

export async function deleteSurveyLists(survey: typeof surveys.$inferSelect) {
  const access = await resolveAccessToken(survey.clientId);
  if (!access) return;
  for (const id of [survey.hsSignedInListId, survey.hsCompletedListId]) {
    if (!id) continue;
    try {
      await hs(access.token, `/crm/v3/lists/${encodeURIComponent(id)}`, {
        method: "DELETE",
        allowStatuses: [404],
      });
    } catch (err) {
      console.error("hubspot list delete", id, err);
    }
  }
}

async function findContactId(token: string, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
    const search = await hs(token, "/crm/v3/objects/contacts/search", {
      method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email"],
        limit: 1,
      },
    });
    const hit = (search.data?.results as { id?: string }[] | undefined)?.[0];
    if (hit?.id) return String(hit.id);
  }
  return null;
}

async function addToList(token: string, listId: string, contactId: string) {
  await hs(token, `/crm/v3/lists/${encodeURIComponent(listId)}/memberships/add`, {
    method: "PUT",
    body: [contactId],
  });
}

export async function addEmailToSurveyList(
  survey: typeof surveys.$inferSelect,
  email: string,
  which: "signedIn" | "completed",
) {
  const fresh = await ensureSurveyLists(survey);
  const listId = which === "signedIn" ? fresh.hsSignedInListId : fresh.hsCompletedListId;
  if (!listId) return;
  const access = await resolveAccessToken(survey.clientId);
  if (!access) return;
  const contactId = await findContactId(access.token, email);
  if (!contactId) throw new Error("HubSpot contact not found for " + email);
  await addToList(access.token, listId, contactId);
  return contactId;
}

export function provisionSurveyLists(survey: typeof surveys.$inferSelect) {
  ensureSurveyLists(survey).catch((err) => console.error("hubspot lists", err));
}

export async function storeHubspotContactId(respondentId: string | null, contactId: string | null) {
  if (!respondentId || !contactId) return;
  await db.update(respondents).set({ hubspotContactId: contactId, lastSeenAt: new Date() }).where(eq(respondents.id, respondentId));
}
