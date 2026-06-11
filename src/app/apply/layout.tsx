import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata("Apply Online", "Submit your admission application online.");

export default async function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const school = await getFeaturedSchool();
  return <PublicShell schoolName={school?.name}>{children}</PublicShell>;
}
