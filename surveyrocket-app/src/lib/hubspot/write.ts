import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { responses, surveys } from "../schema";
import { addEmailToSurveyList, storeHubspotContactId } from "./lists";
import { resolveAccessToken } from "./tokens";

export async function writeSignedInToHubSpot(surveyId: string, email: string, respondentId: string | null) {
  try {
    const [sv] = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
    if (!sv || sv.deletedAt) return;
    if (!(await resolveAccessToken(sv.clientId))) return;
    const contactId = await addEmailToSurveyList(sv, email, "signedIn");
    await storeHubspotContactId(respondentId, contactId || null);
  } catch (err) {
    console.error("hubspot signed_in", err);
  }
}

export async function writeCompletionToHubSpot(responseId: string) {
  const [row] = await db.select().from(responses).where(eq(responses.id, responseId)).limit(1);
  if (!row) return;
  const rec = (row.record || {}) as { respondent?: { email?: string | null } };
  const email = rec.respondent?.email?.trim().toLowerCase() || null;
  if (!email) {
    await db
      .update(responses)
      .set({ hubspotStatus: "skipped", hubspotError: "no email" })
      .where(eq(responses.id, responseId));
    return;
  }
  const [sv] = await db.select().from(surveys).where(eq(surveys.id, row.surveyId)).limit(1);
  if (!sv || sv.deletedAt) {
    await db
      .update(responses)
      .set({ hubspotStatus: "skipped", hubspotError: "survey unavailable" })
      .where(eq(responses.id, responseId));
    return;
  }
  if (!(await resolveAccessToken(row.clientId))) {
    await db
      .update(responses)
      .set({ hubspotStatus: "skipped", hubspotError: "HubSpot not connected" })
      .where(eq(responses.id, responseId));
    return;
  }
  try {
    await addEmailToSurveyList(sv, email, "signedIn");
    const contactId = await addEmailToSurveyList(sv, email, "completed");
    await storeHubspotContactId(row.respondentId, contactId || null);
    await db
      .update(responses)
      .set({ hubspotStatus: "written", hubspotWrittenAt: new Date(), hubspotError: null })
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
