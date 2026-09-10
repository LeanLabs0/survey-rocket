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

async function createOrFindList(token: string, name: string): Promise<{ id: string; created: boolean }> {
  const existing = await findListId(token, name);
  if (existing) return { id: existing, created: false };
  try {
    const created = await hs(token, "/crm/v3/lists", {
      method: "POST",
      body: { name, objectTypeId: OBJECT_CONTACTS, processingType: "MANUAL" },
    });
    const list = created.data?.list as { listId?: string } | undefined;
    const id = list?.listId || (created.data?.listId as string | undefined);
    if (!id) throw new Error("HubSpot did not return a list id");
    return { id: String(id), created: true };
  } catch (err) {
    const again = await findListId(token, name);
    if (again) return { id: again, created: false };
    throw err;
  }
}

const listLocks = new Map<string, Promise<typeof surveys.$inferSelect>>();

export async function ensureSurveyLists(survey: typeof surveys.$inferSelect) {
  if (survey.deletedAt) return survey;
  const pending = listLocks.get(survey.id);
  if (pending) return pending;
  const run = ensureSurveyListsInner(survey).finally(() => {
    if (listLocks.get(survey.id) === run) listLocks.delete(survey.id);
  });
  listLocks.set(survey.id, run);
  return run;
}

async function ensureSurveyListsInner(survey: typeof surveys.$inferSelect) {
  const access = await resolveAccessToken(survey.clientId);
  if (!access) return survey;
  const [latest] = await db.select().from(surveys).where(eq(surveys.id, survey.id)).limit(1);
  let current = latest || survey;
  if (current.deletedAt) return current;
  if (current.hsSignedInListId && current.hsCompletedListId) return current;

  const names = surveyListNames(current.name);
  const token = access.token;

  async function claim(
    field: "hsSignedInListId" | "hsCompletedListId",
    name: string,
  ) {
    if (current[field]) return;
    const made = await createOrFindList(token, name);
    const filter = field === "hsSignedInListId" ? isNull(surveys.hsSignedInListId) : isNull(surveys.hsCompletedListId);
    const patch = field === "hsSignedInListId" ? { hsSignedInListId: made.id } : { hsCompletedListId: made.id };
    const [won] = await db
      .update(surveys)
      .set(patch)
      .where(and(eq(surveys.id, current.id), filter))
      .returning();
    if (won) {
      current = won;
      return;
    }
    if (made.created) {
      await hs(token, `/crm/v3/lists/${encodeURIComponent(made.id)}`, {
        method: "DELETE",
        allowStatuses: [404],
      }).catch(() => null);
    }
    const [again] = await db.select().from(surveys).where(eq(surveys.id, current.id)).limit(1);
    if (again) current = again;
  }

  await claim("hsSignedInListId", names.signedIn);
  await claim("hsCompletedListId", names.completed);
  return current;
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

export type HubSpotContactProps = {
  firstname?: string | null;
  lastname?: string | null;
  company?: string | null;
  website?: string | null;
};

function contactProperties(email: string, extras?: HubSpotContactProps) {
  const properties: Record<string, string> = { email };
  if (extras?.firstname) properties.firstname = extras.firstname;
  if (extras?.lastname) properties.lastname = extras.lastname;
  if (extras?.company) properties.company = extras.company;
  if (extras?.website) properties.website = extras.website;
  return properties;
}

async function getContactByEmail(token: string, email: string) {
  const path = `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
  const got = await hs(token, path, { allowStatuses: [404] });
  if (got.ok && got.data?.id) return String(got.data.id);
  const search = await hs(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    },
  });
  const hit = (search.data?.results as { id?: string }[] | undefined)?.[0];
  return hit?.id ? String(hit.id) : null;
}

async function getOrCreateContact(token: string, email: string, extras?: HubSpotContactProps) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400));
    const id = await getContactByEmail(token, email);
    if (id) return id;
  }
  const created = await hs(token, "/crm/v3/objects/contacts", {
    method: "POST",
    body: { properties: contactProperties(email, extras) },
    allowStatuses: [403, 409],
  });
  if (created.ok && created.data?.id) return String(created.data.id);
  if (created.status === 409) {
    const again = await getContactByEmail(token, email);
    if (again) return again;
  }
  return null;
}

async function addToList(token: string, listId: string, contactId: string) {
  const res = await hs(token, `/crm/v3/lists/${encodeURIComponent(listId)}/memberships/add`, {
    method: "PUT",
    body: [String(contactId)],
  });
  const missing = ((res.data?.recordIdsMissing as string[] | undefined) || []).map(String);
  if (missing.includes(String(contactId))) {
    throw new Error(`HubSpot list ${listId} did not accept contact ${contactId}`);
  }
}

export async function addEmailToSurveyList(
  survey: typeof surveys.$inferSelect,
  email: string,
  which: "signedIn" | "completed",
  extras?: HubSpotContactProps,
) {
  const fresh = await ensureSurveyLists(survey);
  const listId = which === "signedIn" ? fresh.hsSignedInListId : fresh.hsCompletedListId;
  if (!listId) throw new Error(`HubSpot ${which} list missing for survey ${survey.id}`);
  const access = await resolveAccessToken(survey.clientId);
  if (!access) throw new Error("HubSpot not connected");
  const contactId = await getOrCreateContact(access.token, email, extras);
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
