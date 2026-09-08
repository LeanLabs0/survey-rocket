import type { APIRoute } from "astro";
import { supabaseFromCookies } from "../lib/supabase";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = supabaseFromCookies(cookies, request);
  await supabase.auth.signOut();
  return redirect("/");
};
