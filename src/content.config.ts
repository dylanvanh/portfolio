import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
  }),
});

const leg = z.object({
  sport: z.enum(["swim", "bike", "run"]),
  distance: z.number(),
  time: z.number(),
  elevation: z.number().default(0),
  polyline: z.string().optional(),
  strava: z.string().optional(),
});

const races = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/races" }),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    city: z.string(),
    country: z.string(),
    location: z.object({ lat: z.number(), lng: z.number() }),
    kind: z.enum(["triathlon", "run", "ride"]),
    distanceLabel: z.string(),
    time: z.number(),
    official: z.boolean().default(false),
    note: z.string().optional(),
    transitions: z.tuple([z.number(), z.number()]).optional(),
    legs: z.array(leg).min(1),
  }),
});

export const collections = { blog, races };
