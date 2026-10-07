import Link from "next/link";
import { SchoolLogo } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import {
  institutionApplyPath,
  institutionLoginPath,
  type PublicInstitution,
  institutionApplicationsOpen,
} from "@/lib/institution-portal";
import { availablePortalBrand } from "@/lib/brand-assets";
import { schoolThemeCssVars, toSchoolPortalBrand } from "@/lib/school-branding";

export function InstitutionPortalLanding({ school }: { school: PublicInstitution }) {
  const branding = availablePortalBrand(toSchoolPortalBrand(school));
  const applications = institutionApplicationsOpen(school);
  const subtitle =
    school.heroSubtitle?.trim() ||
    school.heroHeadline?.trim() ||
    "School Management Portal";

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={schoolThemeCssVars(branding.primaryColor, branding.accentColor)}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-24 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: branding.primaryColor || "var(--primary)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-64 w-64 rounded-full opacity-15 blur-3xl"
          style={{ background: branding.accentColor || "var(--accent)" }}
        />
      </div>

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-4">
            {branding.logoUrl ? (
              <div className="flex justify-center">
                <SchoolLogo src={branding.logoUrl} name={school.name} size="xl" />
              </div>
            ) : null}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{school.name}</h1>
              <p className="text-muted text-sm sm:text-base">{subtitle}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full h-11 text-base">
              <Link href={institutionLoginPath(school.slug, "staff")}>Staff Login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-11 text-base">
              <Link href={institutionLoginPath(school.slug, "parent")}>Parent Login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-11 text-base">
              <Link href={institutionLoginPath(school.slug, "student")}>Learner Login</Link>
            </Button>
            {applications.open ? (
              <Button asChild variant="secondary" className="w-full h-11 text-base">
                <Link href={institutionApplyPath(school.slug)}>Apply</Link>
              </Button>
            ) : null}
          </div>

          {!applications.open && school.admissionsText ? (
            <p className="text-xs text-muted">{applications.message}</p>
          ) : null}

          <p className="text-xs text-muted">
            Powered by {APP_NAME} · {COMPANY_NAME}
          </p>
        </div>
      </main>
    </div>
  );
}
