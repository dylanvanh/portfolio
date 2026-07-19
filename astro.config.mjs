import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://dylanvh.com",
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
