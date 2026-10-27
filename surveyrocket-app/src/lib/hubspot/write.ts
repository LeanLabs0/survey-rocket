import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { answers, responses, surveyPublications, surveys } from "../schema";
import { answerListsEnabled, answerSegments } from "./answer-lists";
import { addContactToAnswerLists, enrollContactToSurveyLists, type HubSpotContactProps } from "./lists";
import { resolveAccessToken } from "./tokens";

/** The definition the respondent actually answered: their publication, else the latest one. */
async function answeredDefinition(publicationId: string | null, sv: typeof surveys.$inferSelect) {
  if (publicationId) {
    const [pub] = await db.select().from(surveyPublications).where(eq(surveyPublications.id, publicationId)).limit(1);
    if (pub) return pub.definition;
  }
  const [latest] = await db
    .select()
    .from(surveyPublications)
    .where(eq(surveyPublications.surveyId, sv.id))
    .orderBy(desc(surveyPublications.version))
    .limit(1);
  return latest?.definition || sv.definition;
}

export async function writeSignedInToHubSpot(
  surveyId: string,
  email: string,
  respondentId: string | null,
  extras?: HubSpotContactProps,
) {
  const [sv] = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
  if (!sv || sv.deletedAt) return;
  if (!(await resolveAccessToken(sv.clientId))) return;
  await enrollContactToSurveyLists(sv, email, "signedIn", extras, respondentId);
}

export async function writeCompletionToHubSpot(responseId: string) {
  const [row] = await db.select().from(responses).where(eq(responses.id, responseId)).limit(1);
  if (!row) return;
  const rec = (row.record || {}) as {
    respondent?: {
      email?: string | null;
      firstname?: string | null;
      lastname?: string | null;
      company?: string | null;
      website?: string | null;
    };
  };
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
    const extras = {
      firstname: rec.respondent?.firstname as string | undefined,
      lastname: rec.respondent?.lastname as string | undefined,
      company: rec.respondent?.company as string | undefined,
      website: rec.respondent?.website as string | undefined,
    };
    const contactId = await enrollContactToSurveyLists(sv, email, "completed", extras, row.respondentId);
    if (answerListsEnabled(await answeredDefinition(row.publicationId, sv))) {
      const rows = await db.select().from(answers).where(eq(answers.responseId, responseId));
      await addContactToAnswerLists(sv, contactId, answerSegments(rows));
    }
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
