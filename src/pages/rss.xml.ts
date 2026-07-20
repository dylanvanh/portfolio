import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site";

export const GET: APIRoute = async (context) => {
  const site = context.site;
  if (!site) {
    return new Response("Site URL is not configured", { status: 500 });
  }

  const posts = (await getCollection("blog")).sort(
    (firstPost, secondPost) =>
      secondPost.data.pubDate.valueOf() - firstPost.data.pubDate.valueOf(),
  );

  return rss({
    title: `${SITE_NAME} Writing`,
    description: SITE_DESCRIPTION,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/writing/${post.id}/`,
    })),
    customData: "<language>en-ZA</language>",
  });
};
