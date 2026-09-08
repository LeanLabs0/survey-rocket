import type { APIRoute } from "astro";
import { supabaseFromCookies } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  if (password.length < 8) {
    return redirect("/auth/update-password?error=" + encodeURIComponent("Use at least 8 characters."));
  }
  if (password !== confirm) {
    return redirect("/auth/update-password?error=" + encodeURIComponent("Passwords do not match."));
  }
  const supabase = supabaseFromCookies(cookies, request);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return redirect("/auth/update-password?error=" + encodeURIComponent(error.message));
  }
  return redirect("/app");
};
