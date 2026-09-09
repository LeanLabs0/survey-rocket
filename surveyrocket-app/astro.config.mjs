import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: vercel({ maxDuration: 60 }),
  site: "https://beta.surveyrocket.ai",
  security: {
    // Two custom domains on one Vercel project. Request.url is often the
    // *.vercel.app host while Origin is beta.surveyrocket.ai.
    checkOrigin: false,
  },
  integrations: [react()],
  vite: {
    server: { fs: { allow: [".."] } },
    plugins: [tailwindcss()],
  },
});