import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { clients, surveyPublications, surveys } from "../../../../lib/schema";
import { respondentDefinition } from "../../../../lib/definition";

export const GET: APIRoute = async ({ params }) => {
  const publicId = params.publicId;
  if (!publicId) return new Response("Not found", { status: 404 });
  const [sv] = await db.select().from(surveys).where(eq(surveys.publicId, publicId)).limit(1);
  if (!sv || sv.status === "Draft") return new Response("Not found", { status: 404 });
  const [pub] = await db
    .select()
    .from(surveyPublications)
    .where(eq(surveyPublications.surveyId, sv.id))
    .orderBy(desc(surveyPublications.version))
    .limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, sv.clientId)).limit(1);
  const definition = (pub?.definition || sv.definition) as Record<string, unknown>;
  return new Response(
    JSON.stringify({
      public_id: sv.publicId,
      client_name: client?.name || "Survey Rocket",
      logo_url: client?.logoUrl || null,
      definition: respondentDefinition(definition, {
        publicId: sv.publicId,
        clientName: client?.name || "Survey Rocket",
        logoUrl: client?.logoUrl || null,
      }),
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};
