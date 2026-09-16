import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_DASHBOARD, APP_NAME } from "@/lib/constants";
import { isDatabaseReachable } from "@/lib/db-health";
import { getFeaturedSchool } from "@/lib/public-site";
import { toSchoolPortalBrand } from "@/lib/school-branding";
import { availablePortalBrand } from "@/lib/brand-assets";
import { PortalLoginScreen } from "@/components/auth/portal-login-screen";

export const dynamic = "force-dynamic";

export default async function ParentLoginPage() {
  const session = await getSession();
  if (session) redirect(ROLE_DASHBOARD[session.role]);

  const [dbOk, school] = await Promise.all([isDatabaseReachable(), getFeaturedSchool()]);
  const branding = availablePortalBrand(toSchoolPortalBrand(school));
  const displayName = branding.schoolName || APP_NAME;

  return <PortalLoginScreen portal="parent" displayName={displayName} branding={branding} dbOk={dbOk} />;
}
