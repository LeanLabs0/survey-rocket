import type { APIRoute } from "astro";
import { retryFailedHubSpot } from "../../../lib/hubspot/write";

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const qs = url.searchParams.get("secret") || "";
  if (secret && auth !== `Bearer ${secret}` && qs !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const n = await retryFailedHubSpot();
  return new Response(JSON.stringify({ retried: n }), {
    headers: { "Content-Type": "application/json" },
  });
};
