import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
