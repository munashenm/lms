import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { getFeaturedSchool } from "@/lib/public-site";
import { APP_NAME, APP_TAGLINE, DEFAULT_BRAND_MARK_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const school = await getFeaturedSchool();
  const name = school?.name ?? APP_NAME;
  return {
    title: { default: `${name} — ${APP_TAGLINE}`, template: `%s | ${name}` },
    description: school?.heroSubtitle || school?.aboutText || `Admissions and information for ${name}.`,
    icons: school?.faviconUrl
      ? [{ url: school.faviconUrl }]
      : {
          icon: [{ url: "/favicon.ico" }, { url: DEFAULT_BRAND_MARK_URL, type: "image/png" }],
          apple: "/apple-touch-icon.png",
        },
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const school = await getFeaturedSchool();
  return <PublicShell school={school}>{children}</PublicShell>;
}
