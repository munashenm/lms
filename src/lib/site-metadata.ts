import type { Metadata } from "next";
import { APP_NAME, APP_TAGLINE } from "./constants";

export function publicPageMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? `${title} — ${APP_TAGLINE}`,
    openGraph: {
      title: `${title} | ${APP_NAME}`,
      description: description ?? APP_TAGLINE,
      type: "website",
      locale: "en_ZA",
    },
  };
}

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/programmes",
  "/fees",
  "/contact",
  "/apply",
  "/apply/status",
] as const;
