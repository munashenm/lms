import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import Link from "next/link";
import { getFeaturedSchool } from "@/lib/public-site";
import { BrandMark } from "@/components/layout/brand-mark";
import { schoolThemeCssVars, toSchoolPortalBrand } from "@/lib/school-branding";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const branding = toSchoolPortalBrand(await getFeaturedSchool());

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6 bg-background"
      style={schoolThemeCssVars(branding.primaryColor, branding.accentColor)}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <BrandMark logoUrl={branding.logoUrl} name={branding.schoolName} />
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted space-y-3">
            <p>This reset link is missing or invalid.</p>
            <Link href="/forgot-password" className="text-primary hover:underline">
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
