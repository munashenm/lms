import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { getFeaturedSchool } from "@/lib/public-site";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const school = await getFeaturedSchool();
  const name = school?.name ?? APP_NAME;
  return {
    title: { default: `${name} — ${APP_TAGLINE}`, template: `%s | ${name}` },
    description: `Admissions, programmes and school information for ${name}. Apply online and track your application.`,
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const school = await getFeaturedSchool();
  return <PublicShell schoolName={school?.name}>{children}</PublicShell>;
}
