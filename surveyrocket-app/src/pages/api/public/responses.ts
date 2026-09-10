import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { answers, respondents, responses, surveys, surveyPublications } from "../../../lib/schema";
import { desc } from "drizzle-orm";
import { clientCountry, clientIp, hashIp } from "../../../lib/crypto";
import { makeUlid } from "../../../lib/ids";
import { writeCompletionToHubSpot, writeSignedInToHubSpot } from "../../../lib/hubspot/write";
import { notifyResponse, notifyReview } from "../../../lib/notifications";

type IncomingAnswer = {
  question_id: string;
  question_text?: string | null;
  type?: string;
  nps?: boolean;
  value_text?: string | null;
  value_number?: number | null;
  value_list?: string[] | null;
  skipped?: boolean;
};

function parseBody(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function payloadStage(payload: { status?: string; stage?: string; completed_at?: string }) {
  const raw = String(payload.status || payload.stage || "").toLowerCase();
  if (raw === "started" || raw === "start") return "started" as const;
  if (raw === "progress") return "progress" as const;
  if (raw === "completed" || raw === "complete") return "completed" as const;
  return "completed" as const;
}

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const payload = parseBody(raw);
  if (!payload || !payload.survey_id || !payload.client_response_id) {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  }
  const publicId = String(payload.survey_id);
  const [sv] = await db.select().from(surveys).where(eq(surveys.publicId, publicId)).limit(1);
  if (!sv || sv.deletedAt) return new Response(JSON.stringify({ error: "survey not found" }), { status: 404 });
  const [pub] = await db
    .select()
    .from(surveyPublications)
    .where(eq(surveyPublications.surveyId, sv.id))
    .orderBy(desc(surveyPublications.version))
    .limit(1);

  const email = payload.respondent?.email?.trim().toLowerCase() || null;
  const firstname = payload.respondent?.firstname?.trim() || null;
  const lastname = payload.respondent?.lastname?.trim() || null;
  const name =
    payload.respondent?.name?.trim() ||
    [firstname, lastname].filter(Boolean).join(" ").trim() ||
    null;
  const company = payload.respondent?.company?.trim() || null;
  const website = payload.respondent?.website?.trim() || null;
  let respondentId: string | null = null;
  if (email) {
    const existing = await db
      .select()
      .from(respondents)
      .where(and(eq(respondents.clientId, sv.clientId), eq(respondents.email, email)))
      .limit(1);
    if (existing[0]) {
      respondentId = existing[0].id;
      await db
        .update(respondents)
        .set({
          name: name || existing[0].name,
          company: company || existing[0].company,
          website: website || existing[0].website,
          lastSeenAt: new Date(),
        })
        .where(eq(respondents.id, existing[0].id));
    } else {
      const [created] = await db
        .insert(respondents)
        .values({ clientId: sv.clientId, email, name, company, website })
        .returning();
      respondentId = created.id;
    }
  }

  const stage = payloadStage(payload);
  const existingResp = await db
    .select()
    .from(responses)
    .where(and(eq(responses.surveyId, sv.id), eq(responses.clientResponseId, String(payload.client_response_id))))
    .limit(1);

  if (existingResp[0]?.completedAt && stage !== "completed") {
    return new Response(JSON.stringify({ ok: true, response_id: existingResp[0].id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const now = new Date();
  const startedAt = existingResp[0]?.startedAt || (payload.started_at ? new Date(payload.started_at) : now);
  const completing = stage === "completed";
  const completedAt = completing ? now : null;
  const durationMs =
    completing && startedAt && !Number.isNaN(startedAt.getTime())
      ? Math.max(0, now.getTime() - startedAt.getTime())
      : existingResp[0]?.durationMs || null;

  const record = {
    ...payload,
    completed_at: completedAt ? completedAt.toISOString() : null,
    meta: {
      ip_hash: hashIp(clientIp(request)),
      country: clientCountry(request),
      user_agent: request.headers.get("user-agent"),
    },
  };

  let responseId = existingResp[0]?.id || makeUlid();
  const row = {
    clientId: sv.clientId,
    surveyId: sv.id,
    publicationId: pub?.id || null,
    respondentId,
    clientResponseId: String(payload.client_response_id),
    source: payload.source || "share",
    startedAt: Number.isNaN(startedAt.getTime()) ? now : startedAt,
    completedAt,
    durationMs,
    country: clientCountry(request),
    ipHash: hashIp(clientIp(request)),
    userAgent: request.headers.get("user-agent"),
    reviewAsked: Boolean(payload.review?.asked),
    reviewOutcome: payload.review?.outcome || "not_asked",
    quote: payload.quote || {},
    hubspotStatus: completing && email ? "pending" : existingResp[0]?.hubspotStatus || "skipped",
    record,
  };

  const wasComplete = Boolean(existingResp[0]?.completedAt);
  if (existingResp[0]) {
    await db.update(responses).set(row).where(eq(responses.id, existingResp[0].id));
    await db.delete(answers).where(eq(answers.responseId, existingResp[0].id));
    responseId = existingResp[0].id;
  } else {
    await db.insert(responses).values({ id: responseId, ...row });
  }

  const incoming: IncomingAnswer[] = Array.isArray(payload.answers) ? payload.answers : [];
  if (incoming.length) {
    await db.insert(answers).values(
      incoming.map((a) => ({
        responseId,
        clientId: sv.clientId,
        surveyId: sv.id,
        questionKey: a.question_id,
        questionText: a.question_text || null,
        type: a.type || "text",
        nps: !!a.nps,
        valueText: a.value_text ?? null,
        valueNumber: typeof a.value_number === "number" ? Math.round(a.value_number) : null,
        valueList: a.value_list ?? null,
        skipped: !!a.skipped,
      })),
    );
  }

  if (email && (stage === "started" || stage === "progress")) {
    await writeSignedInToHubSpot(sv.id, email, respondentId, { firstname, lastname, company, website });
  }
  if (completing && email) {
    await writeCompletionToHubSpot(responseId);
  }

  const quoteText =
    typeof payload.quote?.text === "string"
      ? payload.quote.text
      : typeof (payload.quote as { _quote?: string } | undefined)?._quote === "string"
        ? (payload.quote as { _quote?: string })._quote
        : "";
  if (completing && !wasComplete) {
    notifyResponse({
      clientId: sv.clientId,
      surveyId: sv.id,
      surveyName: sv.name,
      respondentName: name,
      answerCount: incoming.filter((a) => !a.skipped).length,
    }).catch((err) => console.error("notify response", err));
  }
  if (completing) {
    notifyReview({
      clientId: sv.clientId,
      surveyId: sv.id,
      surveyName: sv.name,
      respondentName: name,
      quoteText: quoteText || null,
      reviewOutcome: payload.review?.outcome || null,
    }).catch((err) => console.error("notify review", err));
  }

  return new Response(JSON.stringify({ ok: true, response_id: responseId }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
