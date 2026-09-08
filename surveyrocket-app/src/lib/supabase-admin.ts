import { createClient } from "@supabase/supabase-js";
import { envVar } from "./env";
import { supabaseUrl } from "./supabase";

/** Secret key (sb_secret_…) or legacy service_role JWT. Server only. */
export function supabaseSecretKey() {
  return envVar("SUPABASE_SECRET_KEY") || envVar("SUPABASE_SERVICE_ROLE");
}

export function supabaseAdmin() {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE) are required");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

