import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { surveys } from "../../../../lib/schema";
import { aggregateSurvey } from "../../../../lib/aggregates";

export const GET: APIRoute = async ({ params }) => {
  const publicId = params.publicId;
  if (!publicId) return new Response("Not found", { status: 404 });
  const [sv] = await db.select().from(surveys).where(eq(surveys.publicId, publicId)).limit(1);
  if (!sv) return new Response("Not found", { status: 404 });
  const agg = await aggregateSurvey(sv.id);
  const questions: Record<string, unknown> = {};
  for (const [key, q] of Object.entries(agg.questions)) {
    questions[key] = {
      question: q.question,
      type: q.type,
      nps: q.nps,
      answers: q.answers,
      average: q.average !== null ? Math.round(q.average * 10) / 10 : null,
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
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};
