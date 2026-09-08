import type { APIRoute } from "astro";
import { factor8Turn } from "../../../lib/factor8";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response(JSON.stringify({ degraded: true }), { status: 200 });
  try {
    const out = await factor8Turn(body);
    return new Response(JSON.stringify(out.data ?? { degraded: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ degraded: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
