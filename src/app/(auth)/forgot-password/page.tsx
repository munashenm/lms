import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ArrowLeft } from "lucide-react";
import { getFeaturedSchool } from "@/lib/public-site";
import { BrandMark } from "@/components/layout/brand-mark";
import { schoolThemeCssVars, toSchoolPortalBrand } from "@/lib/school-branding";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
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
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-primary">
            <ArrowLeft className="h-3 w-3" />
            Back to public site
          </Link>
        </p>
      </div>
    </div>
  );
}
