import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSchoolBySlug } from "@/lib/institution-portal";
import { InstitutionPortalLanding } from "@/components/campus/institution-portal-landing";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ schoolSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) return { title: "Institution not found" };
  return {
    title: `${school.name} | ${APP_NAME}`,
    description: school.heroSubtitle || school.aboutText || `${school.name} portal`,
    icons: school.faviconUrl ? [{ url: school.faviconUrl }] : undefined,
  };
}

export default async function InstitutionPortalPage({ params }: PageProps) {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();
  return <InstitutionPortalLanding school={school} />;
}
