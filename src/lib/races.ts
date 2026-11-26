import type { CollectionEntry } from "astro:content";
import type { ImageMetadata } from "astro";

export type Race = CollectionEntry<"races">;
export type Leg = Race["data"]["legs"][number];

export const KIND_LABEL: Record<Race["data"]["kind"], string> = {
  triathlon: "Triathlon",
  run: "Run",
  ride: "Ride",
};

export const SPORT_LABEL: Record<Leg["sport"], string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
};

export function formatTime(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatDistance(meters: number): string {
  if (meters < 5000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000).toLocaleString("en-US")} km`;
}

export function formatPace(leg: Leg): string {
  if (leg.sport === "bike") {
    return `${(leg.distance / 1000 / (leg.time / 3600)).toFixed(1)} km/h`;
  }
  const per = leg.sport === "swim" ? 100 : 1000;
  const unit = leg.sport === "swim" ? "/100m" : "/km";
  return `${formatTime(leg.time / (leg.distance / per))} ${unit}`;
}

export function formatDate(date: Date, withYear = true): string {
  return date.toLocaleDateString("en-US", {
    year: withYear ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const raceDistance = (race: Race) =>
  race.data.legs.reduce((sum, leg) => sum + leg.distance, 0);

export const raceElevation = (race: Race) =>
  race.data.legs.reduce((sum, leg) => sum + leg.elevation, 0);

export const byNewest = (a: Race, b: Race) =>
  b.data.date.valueOf() - a.data.date.valueOf();

/** Decodes a Google encoded polyline into [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

const photoModules = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/races/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}",
  { eager: true },
);

/** Photos live in src/assets/races/<race id>/. A file named cover.* leads. */
export function racePhotos(raceId: string) {
  const prefix = `/src/assets/races/${raceId}/`;
  const photos = Object.entries(photoModules)
    .filter(([path]) => path.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, mod]) => ({
      name: path.slice(prefix.length),
      image: mod.default,
    }));
  const cover = photos.find((p) => p.name.toLowerCase().startsWith("cover"));
  return { cover, gallery: photos.filter((p) => p !== cover) };
}
