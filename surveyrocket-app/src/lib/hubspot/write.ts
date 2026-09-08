import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { hubspotConnections, respondents, responses, surveys } from "../schema";
import { resolveAccessToken } from "./tokens";

const CONTACT_PROPS = [
  { name: "sr_last_survey", label: "Survey Rocket last survey", type: "string", fieldType: "text", groupName: "contactinformation" },
  { name: "sr_last_completed_at", label: "Survey Rocket last completed", type: "datetime", fieldType: "date", groupName: "contactinformation" },
];

async function hs(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function ensureContactProperties(token: string, slug: string) {
  const extra = {
    name: `sr_completed__${slug.replace(/[^a-z0-9_]+/gi, "_").slice(0, 80)}`,
    label: `Survey Rocket completed: ${slug}`,
    type: "datetime",
    fieldType: "date",
    groupName: "contactinformation",
  };
  for (const prop of [...CONTACT_PROPS, extra]) {
    const existing = await hs(token, `/crm/v3/properties/contacts/${prop.name}`);
    if (existing.ok) continue;
    await hs(token, "/crm/v3/properties/contacts", {
      method: "POST",
      body: JSON.stringify(prop),
    });
  }
  return extra.name;
}

async function upsertContact(token: string, email: string, name: string | null) {
  const search = await hs(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "firstname"],
      limit: 1,
    }),
  });
  const first = name?.split(" ")[0] || undefined;
  const last = name?.split(" ").slice(1).join(" ") || undefined;
  const props: Record<string, string> = { email };
  if (first) props.firstname = first;
  if (last) props.lastname = last;
  const hit = search.data?.results?.[0];
  if (hit?.id) {
    await hs(token, `/crm/v3/objects/contacts/${hit.id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: props }),
    });
    return String(hit.id);
  }
  const created = await hs(token, "/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: props }),
  });
  if (!created.ok) throw new Error(created.data?.message || "Contact upsert failed");
  return String(created.data.id);
}

async function ensureSurveyObject(token: string, clientId: string, surveyName: string, surveySlug: string) {
  const connRows = await db
    .select()
    .from(hubspotConnections)
    .where(eq(hubspotConnections.clientId, clientId))
    .limit(1);
  const conn = connRows[0];
  let typeId = conn?.surveyObjectTypeId || "";
  if (!typeId) {
    const schemas = await hs(token, "/crm/v3/schemas");
    if (!schemas.ok) return null;
    const existing = (schemas.data?.results || []).find(
      (s: { name?: string }) => s.name === "survey_rocket_survey",
    );
    if (existing) {
      typeId = existing.objectTypeId || existing.id;
    } else {
      const created = await hs(token, "/crm/v3/schemas", {
        method: "POST",
        body: JSON.stringify({
          name: "survey_rocket_survey",
          labels: { singular: "Survey Rocket survey", plural: "Survey Rocket surveys" },
          primaryDisplayProperty: "survey_name",
          properties: [
            { name: "survey_name", label: "Survey name", type: "string", fieldType: "text" },
            { name: "survey_slug", label: "Survey slug", type: "string", fieldType: "text" },
          ],
          associatedObjects: ["CONTACT"],
        }),
      });
      if (!created.ok) return null;
      typeId = created.data.objectTypeId || created.data.id;
    }
    if (typeId) {
      await db
        .update(hubspotConnections)
        .set({ surveyObjectTypeId: String(typeId) })
        .where(eq(hubspotConnections.clientId, clientId));
    }
  }
  if (!typeId) return null;
  const search = await hs(token, `/crm/v3/objects/${typeId}/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "survey_slug", operator: "EQ", value: surveySlug }] }],
      limit: 1,
    }),
  });
  let objectId = search.data?.results?.[0]?.id;
  if (!objectId) {
    const created = await hs(token, `/crm/v3/objects/${typeId}`, {
      method: "POST",
      body: JSON.stringify({ properties: { survey_name: surveyName, survey_slug: surveySlug } }),
    });
    if (!created.ok) return { typeId, objectId: null };
    objectId = created.data.id;
  }
  return { typeId, objectId };
}

export async function writeCompletionToHubSpot(responseId: string) {
  const [row] = await db.select().from(responses).where(eq(responses.id, responseId)).limit(1);
  if (!row) return;
  const rec = (row.record || {}) as {
    respondent?: { email?: string | null; name?: string | null };
  };
  const email = rec.respondent?.email?.trim().toLowerCase();
  if (!email) {
    await db
      .update(responses)
      .set({ hubspotStatus: "skipped", hubspotError: "no email" })
      .where(eq(responses.id, responseId));
    return;
  }
  const access = await resolveAccessToken(row.clientId);
  if (!access) {
    await db
      .update(responses)
      .set({ hubspotStatus: "skipped", hubspotError: "HubSpot not connected" })
      .where(eq(responses.id, responseId));
    return;
  }
  try {
    const [sv] = await db.select().from(surveys).where(eq(surveys.id, row.surveyId)).limit(1);
    const slug = sv?.slug || "survey";
    const completedProp = await ensureContactProperties(access.token, slug);
    const contactId = await upsertContact(access.token, email, rec.respondent?.name || null);
    const completedAt = (row.completedAt || new Date()).toISOString();
    await hs(access.token, `/crm/v3/objects/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          sr_last_survey: sv?.name || slug,
          sr_last_completed_at: completedAt,
          [completedProp]: completedAt,
        },
      }),
    });
    if (row.respondentId) {
      await db
        .update(respondents)
        .set({ hubspotContactId: contactId, lastSeenAt: new Date() })
        .where(eq(respondents.id, row.respondentId));
    }
    const obj = await ensureSurveyObject(access.token, row.clientId, sv?.name || slug, slug);
    if (obj?.objectId) {
      await hs(
        access.token,
        `/crm/v4/objects/contacts/${contactId}/associations/default/${obj.typeId}/${obj.objectId}`,
        { method: "PUT", body: JSON.stringify([]) },
      );
    }
    await db
      .update(responses)
      .set({
        hubspotStatus: "written",
        hubspotWrittenAt: new Date(),
        hubspotError: null,
      })
      .where(eq(responses.id, responseId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(responses)
      .set({ hubspotStatus: "failed", hubspotError: message.slice(0, 500) })
      .where(eq(responses.id, responseId));
  }
}

export async function retryFailedHubSpot(limit = 25) {
  const failed = await db
    .select({ id: responses.id })
    .from(responses)
    .where(inArray(responses.hubspotStatus, ["failed", "pending"]))
    .limit(limit);
  for (const row of failed) {
    await writeCompletionToHubSpot(row.id);
  }
  return failed.length;
}
