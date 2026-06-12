import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Building2, ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
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
