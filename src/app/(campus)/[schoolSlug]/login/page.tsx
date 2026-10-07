import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_DASHBOARD, APP_NAME } from "@/lib/constants";
import { isDatabaseReachable } from "@/lib/db-health";
import { getSchoolBySlug } from "@/lib/institution-portal";
import { toSchoolPortalBrand } from "@/lib/school-branding";
import { availablePortalBrand } from "@/lib/brand-assets";
import { PortalLoginScreen } from "@/components/auth/portal-login-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function InstitutionStaffLoginPage({ params }: PageProps) {
  const session = await getSession();
  if (session) redirect(ROLE_DASHBOARD[session.role]);

  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [dbOk] = await Promise.all([isDatabaseReachable()]);
  const branding = availablePortalBrand(toSchoolPortalBrand(school));
  const displayName = branding.schoolName || school.name || APP_NAME;

  return (
    <PortalLoginScreen
      portal="staff"
      displayName={displayName}
      branding={branding}
      dbOk={dbOk}
      schoolSlug={school.slug}
    />
  );
}
