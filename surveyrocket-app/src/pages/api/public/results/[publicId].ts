import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { surveys } from "../../../../lib/schema";
import { aggregateSurvey } from "../../../../lib/aggregates";

export const GET: APIRoute = async ({ params, url }) => {
  const publicId = params.publicId;
  if (!publicId) return new Response("Not found", { status: 404 });
  const [sv] = await db.select().from(surveys).where(eq(surveys.publicId, publicId)).limit(1);
  if (!sv || sv.deletedAt) return new Response("Not found", { status: 404 });
  // The finishing respondent's own run; their page adds it back on top of everyone else.
  const exclude = (url.searchParams.get("exclude") || "").trim().slice(0, 100) || null;
  const agg = await aggregateSurvey(sv.id, { excludeClientResponseId: exclude });
  const questions: Record<string, unknown> = {};
  for (const [key, q] of Object.entries(agg.questions)) {
    questions[key] = {
      question: q.question,
      type: q.type,
      nps: q.nps,
      answers: q.answers,
      // Exact mean. The chart rounds to one decimal when it draws, and the
      // respondent page adds their own number on top of this one.
      average: q.average,
      choices: q.choices,
    };
  }
  return new Response(
    JSON.stringify({
      responses: agg.responses,
      this_week: agg.this_week,
      latest_at: agg.latest_at,
      questions,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        // Body depends on ?exclude=, so a shared cache must not reuse one person's totals.
        "Cache-Control": "private, no-store",
      },
    },
  );
};
