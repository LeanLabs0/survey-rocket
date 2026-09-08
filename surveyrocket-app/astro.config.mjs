import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: vercel({ maxDuration: 60 }),
  integrations: [react()],
  vite: {
    server: { fs: { allow: [".."] } },
    plugins: [tailwindcss()],
  },
});