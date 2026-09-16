import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Database, ArrowLeft } from "lucide-react";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/lib/constants";
import { BrandMark, SchoolLogo } from "@/components/layout/brand-mark";
import { schoolThemeCssVars, toSchoolPortalBrand } from "@/lib/school-branding";
import type { LoginPortal } from "@/lib/login-portals";
import { portalLoginPath } from "@/lib/login-portals";

const COPY: Record<
  LoginPortal,
  { heading: string; body: string; title: string; description: string; chips: string[] }
> = {
  staff: {
    heading: "Staff Portal",
    body: "Administrators, teachers, finance and campus staff sign in here. Learners and parents use their own portals.",
    title: "Staff sign in",
    description: "Use your staff email to open the dashboard for your role.",
    chips: ["Admin", "Teachers", "Finance", "Admissions"],
  },
  student: {
    heading: "Student Portal",
    body: "Learners and students sign in here to view timetables, results, fees and notices.",
    title: "Student sign in",
    description: "Use the email provided by your institution.",
    chips: ["Timetable", "Results", "Fees", "Notices"],
  },
  parent: {
    heading: "Parent Portal",
    body: "Parents and guardians sign in here to follow academic progress, attendance and school fees.",
    title: "Parent sign in",
    description: "Use the email linked to your child's record.",
    chips: ["Progress", "Attendance", "Fees", "Notices"],
  },
};

export function PortalLoginScreen({
  portal,
  displayName,
  branding,
  dbOk,
}: {
  portal: LoginPortal;
  displayName: string;
  branding: ReturnType<typeof toSchoolPortalBrand>;
  dbOk: boolean;
}) {
  const copy = COPY[portal];

  return (
    <div
      className="flex min-h-screen"
      style={schoolThemeCssVars(branding.primaryColor, branding.accentColor)}
    >
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white">
        <BrandMark
          logoUrl={branding.logoUrl}
          name={displayName}
          subtitle={copy.heading}
          inverted
          size="xl"
          stacked
        />
        <div className="space-y-6">
          <h2 className="text-3xl font-bold leading-tight">{copy.heading}</h2>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">{copy.body}</p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {copy.chips.map((item) => (
              <div key={item} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40">Powered by {COMPANY_NAME}</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center gap-3">
            {branding.logoUrl ? (
              <SchoolLogo src={branding.logoUrl} name={displayName} size="xl" />
            ) : (
              <BrandMark name={displayName} subtitle={copy.heading} size="lg" stacked />
            )}
            {branding.logoUrl ? (
              <div>
                <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
                <p className="text-muted text-sm">{copy.heading}</p>
              </div>
            ) : null}
          </div>
          {!dbOk && (
            <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-sm text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Database className="h-4 w-4" />
                Database not connected
              </div>
              <p>
                PostgreSQL is not running. Login will fail until the database is started and seeded.
              </p>
            </div>
          )}
          <Suspense fallback={<p className="text-sm text-muted text-center">Loading sign in…</p>}>
            <LoginForm
              dbReady={dbOk}
              portal={portal}
              title={copy.title}
              description={copy.description}
            />
          </Suspense>
          <div className="text-center text-sm text-muted space-y-2">
            {portal !== "student" ? (
              <p>
                Learner or student?{" "}
                <Link href={portalLoginPath("student")} className="text-primary font-medium hover:underline">
                  Student Portal
                </Link>
              </p>
            ) : null}
            {portal !== "parent" ? (
              <p>
                Parent or guardian?{" "}
                <Link href={portalLoginPath("parent")} className="text-primary font-medium hover:underline">
                  Parent Portal
                </Link>
              </p>
            ) : null}
            {portal !== "staff" ? (
              <p>
                Staff member?{" "}
                <Link href={portalLoginPath("staff")} className="text-primary font-medium hover:underline">
                  Staff Portal
                </Link>
              </p>
            ) : null}
            <p>
              <Link href="/" className="inline-flex items-center gap-1 hover:text-primary">
                <ArrowLeft className="h-3 w-3" />
                Back to public site
              </Link>
            </p>
          </div>
          <p className="sr-only">{APP_NAME} {APP_TAGLINE}</p>
        </div>
      </div>
    </div>
  );
}
