import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    return new Response("Site URL is not configured", { status: 500 });
  }

  const sitemapURL = new URL("sitemap-index.xml", site);
  const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapURL.href}\n`;

  return new Response(robotsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
