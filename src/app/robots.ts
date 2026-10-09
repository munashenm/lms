import type { MetadataRoute } from "next";
import { publicAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/about",
        "/admissions",
        "/academics",
        "/programmes",
        "/fees",
        "/news",
        "/calendar",
        "/gallery",
        "/contact",
        "/privacy",
        "/apply",
      ],
      disallow: ["/admin", "/teacher", "/student", "/parent", "/finance", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
