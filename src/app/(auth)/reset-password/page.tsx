import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Building2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
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
