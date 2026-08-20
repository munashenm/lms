import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { Database, ArrowLeft } from "lucide-react";
import { APP_TAGLINE, COMPANY_NAME } from "@/lib/constants";
import { isDatabaseReachable } from "@/lib/db-health";
import { getFeaturedSchool } from "@/lib/public-site";
import { BrandMark } from "@/components/layout/brand-mark";
import { schoolThemeCssVars, toSchoolPortalBrand } from "@/lib/school-branding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_DASHBOARD[session.role]);
  }

  const [dbOk, school] = await Promise.all([isDatabaseReachable(), getFeaturedSchool()]);
  const branding = toSchoolPortalBrand(school);

  return (
    <div
      className="flex min-h-screen"
      style={schoolThemeCssVars(branding.primaryColor, branding.accentColor)}
    >
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white">
        <BrandMark
          logoUrl={branding.logoUrl}
          name={branding.schoolName}
          subtitle={APP_TAGLINE}
          inverted
        />

        <div className="space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            Manage your school<br />with confidence.
          </h2>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Built for South African schools, colleges and TVET institutions.
            POPIA-compliant, ZAR-ready, and load-shedding friendly.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {["CAPS / NSC", "TVET Modules", "ZAR Finance", "POPIA Safe"].map((item) => (
              <div key={item} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">© {COMPANY_NAME}</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center">
            <BrandMark
              logoUrl={branding.logoUrl}
              name={branding.schoolName}
              subtitle={APP_TAGLINE}
            />
          </div>
          {!dbOk && (
            <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-sm text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Database className="h-4 w-4" />
                Database not connected
              </div>
              <p>PostgreSQL is not running on <code className="text-xs bg-red-100 px-1 rounded">localhost:5432</code>. Login will fail until the database is started and seeded.</p>
              <ol className="list-decimal list-inside text-xs space-y-1 text-red-800">
                <li>Install <strong>Docker Desktop</strong> or <strong>PostgreSQL 16</strong></li>
                <li>Start DB: <code className="bg-red-100 px-1 rounded">docker compose up -d</code></li>
                <li>Setup: <code className="bg-red-100 px-1 rounded">npm run db:push</code> then <code className="bg-red-100 px-1 rounded">npm run db:seed</code></li>
              </ol>
            </div>
          )}
          <LoginForm dbReady={dbOk} />
          <p className="text-center text-sm text-muted">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-primary">
              <ArrowLeft className="h-3 w-3" />
              Back to public site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
