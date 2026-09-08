import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser(url: string, key: string) {
  return createBrowserClient(url, key, {
    auth: {
      experimental: { passkey: true },
    } as { experimental: { passkey: boolean } },
  });
}
